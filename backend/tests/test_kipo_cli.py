"""The conductor's command line: frontier and dispatch, against a fake effort."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

from fakes import FakeGh  # noqa: F401  (puts the backend on sys.path)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kipo_cli  # noqa: E402


def fake_detail(repo_path):
    tiles = [
        {"number": 4, "title": "T4", "type": "build", "lane": "deliver", "state": "afk", "blockedBy": []},
        {"number": 5, "title": "T5", "type": "build", "lane": "deliver", "state": "blocked", "blockedBy": [4]},
    ]
    return {"repoPath": repo_path, "frontier": {"tiles": tiles, "fogItems": [], "fogLeft": []}, "prs": []}


class Cli(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        svc = mock.MagicMock()
        svc.detail.return_value = fake_detail(self.tmp)
        self.patches = [mock.patch.object(kipo_cli, "Initiatives", return_value=svc),
                        mock.patch.object(kipo_cli, "Gh"), mock.patch.object(kipo_cli, "Storage")]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = kipo_cli.main(list(args))
        return code, out.getvalue(), err.getvalue()

    def queue(self):
        with open(os.path.join(self.tmp, ".kipo", "7", "conductor.json")) as f:
            return json.load(f)["dispatch"]

    def test_frontier_prints_threads(self):
        code, out, _ = self.run_cli("frontier", "acme/widgets", "7")
        self.assertEqual(code, 0)
        data = json.loads(out)
        self.assertEqual([t["id"] for t in data["threads"]], ["t4", "t5", "retro"])

    def test_dispatch_queues_once(self):
        code, out, _ = self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4")
        self.assertEqual((code, json.loads(out)["queued"]), (0, True))
        code, out, _ = self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4")
        self.assertEqual(json.loads(out)["queued"], False)
        self.run_cli("dispatch", "acme/widgets", "7", "--stage", "review")
        self.assertEqual([(e.get("ticket"), e.get("stage")) for e in self.queue()], [(4, None), (None, "review")])

    def test_dispatch_review_after_build_on_the_same_ticket(self):
        # #995's case: the build entry {"ticket": T} must not swallow T's kipo-review.
        self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4")
        code, out, _ = self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4", "--skill", "kipo-review")
        self.assertEqual((code, json.loads(out)["queued"]), (0, True))
        self.assertEqual([(e.get("ticket"), e.get("skill")) for e in self.queue()], [(4, None), (4, "kipo-review")])

    def test_dispatch_review_twice_is_still_deduped(self):
        self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4")
        self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4", "--skill", "kipo-review")
        code, out, _ = self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4", "--skill", "kipo-review")
        self.assertEqual((code, json.loads(out)["queued"], json.loads(out)["reason"]), (0, False, "already queued"))
        # A later, different skill on the same ticket queues once too.
        later = ("dispatch", "acme/widgets", "7", "--ticket", "4", "--skill", "diagnosing-bugs")
        self.assertTrue(json.loads(self.run_cli(*later)[1])["queued"])
        self.assertFalse(json.loads(self.run_cli(*later)[1])["queued"])
        self.assertEqual(len(self.queue()), 3)

    def test_dispatch_stage_dedups_on_skill_too(self):
        self.run_cli("dispatch", "acme/widgets", "7", "--stage", "review")
        self.assertTrue(json.loads(self.run_cli("dispatch", "acme/widgets", "7", "--stage", "review", "--skill", "code-review")[1])["queued"])
        self.assertFalse(json.loads(self.run_cli("dispatch", "acme/widgets", "7", "--stage", "review")[1])["queued"])
        self.assertEqual(len(self.queue()), 2)

    def test_dispatch_grill_queues_the_effort_grill(self):
        code, out, _ = self.run_cli("dispatch", "acme/widgets", "7", "--stage", "grill")
        self.assertEqual((code, json.loads(out)["queued"]), (0, True))
        self.assertFalse(json.loads(self.run_cli("dispatch", "acme/widgets", "7", "--stage", "grill")[1])["queued"])
        self.assertEqual([(e.get("ticket"), e.get("stage")) for e in self.queue()], [(None, "grill")])

    def test_dispatch_refuses_blocked_or_unknown(self):
        self.assertEqual(self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "5")[0], 2)
        self.assertEqual(self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "99")[0], 2)

    def test_dispatch_keeps_the_rest_of_the_state_file(self):
        os.makedirs(os.path.join(self.tmp, ".kipo", "7"))
        with open(os.path.join(self.tmp, ".kipo", "7", "conductor.json"), "w") as f:
            json.dump({"decisions": [{"id": "d1"}]}, f)
        self.run_cli("dispatch", "acme/widgets", "7", "--ticket", "4")
        with open(os.path.join(self.tmp, ".kipo", "7", "conductor.json")) as f:
            data = json.load(f)
        self.assertEqual(data["decisions"], [{"id": "d1"}])
        self.assertEqual(len(data["dispatch"]), 1)


SLOT = "kipo-acme-widgets-7-review"


class Redispatch(Cli):
    """A thread whose session is dead (stuck, or closed) can be dispatched again:
    the entry carries ``replace`` (the old slot) so the page closes it and starts
    a fresh one. A live session's thread is still "already queued"."""

    def with_session(self, key="review", slot=SLOT, status="open", stall=None, tiles=None, ref_prs=(), started=True):
        d = fake_detail(self.tmp)
        if tiles is not None:
            d["frontier"]["tiles"] = tiles
        d["sessions"] = {key: slot}
        row = {"key": key, "slot": slot, "status": status, "reason": "x"}
        if not started:
            row["started"] = False
        if stall:
            row["stall"] = {"state": stall, "why": "woken 2 times with no answer", "id": "idle@a", "wakes": 2}
        d["closing"] = [row]
        d["refPrs"] = list(ref_prs)
        kipo_cli.Initiatives.return_value.detail.return_value = d

    def dispatch(self, *extra):
        code, out, err = self.run_cli("dispatch", "acme/widgets", "7", *extra)
        return code, (json.loads(out) if out else None), err

    def test_live_session_is_already_queued(self):
        self.with_session()
        self.dispatch("--stage", "review")
        code, out, _ = self.dispatch("--stage", "review")
        self.assertEqual((code, out["queued"]), (0, False))
        self.assertIn("already queued", out["reason"])
        self.assertNotIn("replace", self.queue()[-1])

    def test_stuck_session_is_replaced(self):
        self.with_session()
        self.dispatch("--stage", "review")
        self.with_session(stall="stuck")
        code, out, _ = self.dispatch("--stage", "review")
        self.assertEqual((code, out["queued"], out["replaces"]), (0, True, SLOT))
        self.assertEqual([e.get("replace") for e in self.queue()], [None, SLOT])
        # Once is enough: the replacement is pending.
        code, out, _ = self.dispatch("--stage", "review")
        self.assertEqual((out["queued"], len(self.queue())), (False, 2))
        self.assertIn("replacement", out["reason"])

    def test_closed_session_is_replaced(self):
        self.with_session(status="closed")
        self.dispatch("--stage", "review")
        self.assertEqual(self.queue()[-1]["replace"], SLOT)

    def test_a_session_that_never_started_is_replaced(self):
        # #201's plan: queued 2026-11-15T08:59:20Z, recorded, its chat never started.
        self.with_session(key="plan", slot="kipo-acme-widgets-7-plan")
        self.dispatch("--stage", "plan")
        self.with_session(key="plan", slot="kipo-acme-widgets-7-plan", started=False)
        code, out, _ = self.dispatch("--stage", "plan")
        self.assertEqual((code, out["queued"], self.queue()[-1]["replace"]), (0, True, "kipo-acme-widgets-7-plan"))
        self.assertIn("never started", out["why"])

    def test_replace_flag_when_the_human_closed_it(self):
        self.with_session()
        self.dispatch("--stage", "review")
        code, out, _ = self.dispatch("--stage", "review", "--replace")
        self.assertEqual((code, out["queued"], self.queue()[-1]["replace"]), (0, True, SLOT))

    def test_ticket_review_session_replaced(self):
        self.with_session(key="review-t4", slot="kipo-acme-widgets-7-review-t4", stall="stuck")
        code, out, _ = self.dispatch("--ticket", "4", "--skill", "kipo-review")
        self.assertEqual(self.queue()[-1]["replace"], "kipo-acme-widgets-7-review-t4")

    def test_ticket_build_session_replaced(self):
        self.with_session(key="build-t4", slot="kipo-acme-widgets-7-build-t4", stall="stuck")
        self.dispatch("--ticket", "4")
        self.assertEqual(self.queue()[-1]["replace"], "kipo-acme-widgets-7-build-t4")

    def test_a_done_ticket_can_get_a_review_for_a_pr_naming_it(self):
        # #201's #208: closed, but PRs #609/#611/#612 name it without closing it.
        tiles = [{"number": 208, "title": "ADR", "type": "grilling", "lane": "decide", "state": "done", "blockedBy": []}]
        self.with_session(key="conductor", slot="c", tiles=tiles,
                          ref_prs=[{"number": 609, "state": "OPEN", "tickets": [], "refs": [208]}])
        code, out, _ = self.dispatch("--ticket", "208", "--skill", "kipo-review")
        self.assertEqual((code, out["queued"]), (0, True))
        # Its build is still nothing to start.
        self.assertEqual(self.dispatch("--ticket", "208")[0], 2)

    def test_a_done_ticket_with_no_open_pr_is_still_refused(self):
        tiles = [{"number": 208, "title": "ADR", "type": "grilling", "lane": "decide", "state": "done", "blockedBy": []}]
        self.with_session(key="conductor", slot="c", tiles=tiles,
                          ref_prs=[{"number": 609, "state": "MERGED", "tickets": [], "refs": [208]}])
        self.assertEqual(self.dispatch("--ticket", "208", "--skill", "kipo-review")[0], 2)


if __name__ == "__main__":
    unittest.main()
