"""The close rule (kipo/closing.py): which stage sessions KiPo closes, as a pure
function of the effort detail and its reports; plus where it surfaces (the
detail, the record endpoint, `kipo_cli.py sessions`)."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

from fakes import FakeGh  # noqa: F401  (puts the backend on sys.path)

from kipo import closing
from kipo.storage import Storage

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kipo_cli  # noqa: E402


def rep(source, event, text="x", items=None, id_=1):
    r = {"id": id_, "at": "2026-11-10T10:00:00Z", "from": source, "event": event, "text": text}
    if items:
        r["items"] = items
    return r


def card(answer=None):
    return {"id": "q", "title": "Q", "options": ["A", "B"], "recommended": "A", "answer": answer}


def detail(sessions, tickets=(), prs=(), tiles=(), state=None, states=None, landed=False, decide=False, fog=0, deliver=0):
    keys = {k: f"kipo-acme-widgets-7-{k}" for k in sessions}
    return {
        "sessions": keys,
        "tickets": [{"number": n, "state": s} for n, s in tickets],
        "prs": [{"number": n, "state": s, "tickets": list(t)} for n, s, t in prs],
        "frontier": {"tiles": [{"number": n, "state": s} for n, s in tiles], "landed": landed, "fog": fog,
                     "active": {"decide": decide, "deliver": not landed}, "lanes": {"deliver": {"afk": deliver}}},
        "state": state,
        "sessionStates": states or {},
    }


def verdict(d, reports=(), closed=None):
    return {r["key"]: r["status"] for r in closing.sessions(d, list(reports), closed)}


class TicketSessions(unittest.TestCase):
    def test_build_closes_once_finished_and_ticket_closed(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")])
        self.assertEqual(verdict(d, [rep("build-t4", "started"), rep("build-t4", "finished")]), {"build-t4": "closable"})

    def test_build_still_working_stays_open_even_when_ticket_closed(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")])
        self.assertEqual(verdict(d, [rep("build-t4", "started")]), {"build-t4": "open"})

    def test_finished_build_stays_open_while_its_pr_waits_without_a_review(self):
        d = detail(["build-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
        self.assertEqual(verdict(d, [rep("build-t4", "finished")]), {"build-t4": "open"})

    def test_finished_build_closes_once_the_review_owns_its_pr(self):
        d = detail(["build-t4", "review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
        out = verdict(d, [rep("build-t4", "finished"), rep("review-t4", "started")])
        self.assertEqual(out, {"build-t4": "closable", "review-t4": "open"})

    def test_review_closes_when_its_pr_merged_and_it_finished(self):
        d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "MERGED", [4])])
        self.assertEqual(verdict(d, [rep("review-t4", "pr-merged"), rep("review-t4", "finished")]), {"review-t4": "closable"})

    def test_review_with_open_pr_stays_even_if_finished(self):
        d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
        self.assertEqual(verdict(d, [rep("review-t4", "finished")]), {"review-t4": "open"})

    def test_decision_ticket_closes_with_its_ticket(self):
        d = detail(["shape-t9"], tiles=[(9, "done")])
        self.assertEqual(verdict(d, [rep("shape-t9", "nothing-to-do")]), {"shape-t9": "closable"})
        d = detail(["shape-t9"], tiles=[(9, "you")])
        self.assertEqual(verdict(d, [rep("shape-t9", "finished")]), {"shape-t9": "open"})

    def test_legacy_t_reports_count_for_the_tickets_conversations(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")])
        self.assertEqual(verdict(d, [rep("t4", "finished")]), {"build-t4": "closable"})

    def test_reports_from_another_session_dont_count(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")])
        self.assertEqual(verdict(d, [rep("build-t4", "started"), rep("review-t4", "finished"), rep("t5", "finished")]),
                         {"build-t4": "open"})


class Finished(unittest.TestCase):
    def test_failed_alone_is_not_finished(self):
        self.assertFalse(closing.finished([rep("build-t4", "failed")])[0])

    def test_failed_then_superseded_is_finished(self):
        ok, why = closing.finished([rep("build-t4", "failed"), rep("build-t4", "started")])
        self.assertTrue(ok)
        self.assertIn("superseded", why)

    def test_blocked_or_asked_is_not_finished(self):
        self.assertFalse(closing.finished([rep("plan", "asked"), rep("plan", "blocked")])[0])

    def test_never_reported_counts_as_finished(self):
        self.assertTrue(closing.finished([])[0])


class Guards(unittest.TestCase):
    def test_conductor_is_never_closed(self):
        d = detail(["conductor"], landed=True)
        self.assertEqual(verdict(d, [rep("conductor", "finished")]), {"conductor": "open"})

    def test_unanswered_card_keeps_a_ticket_session_open(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")], states={"build-t4": {"decisions": [card()]}})
        rows = closing.sessions(d, [rep("build-t4", "finished")])
        self.assertEqual((rows[0]["status"], rows[0]["reason"]), ("open", "1 unanswered decision card"))

    def test_answered_cards_dont_hold_it(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")], states={"build-t4": {"decisions": [card("A")]}})
        self.assertEqual(verdict(d, [rep("build-t4", "finished")]), {"build-t4": "closable"})

    def test_unanswered_card_in_a_stage_sessions_own_file_keeps_it_open(self):
        d = detail(["review"], prs=[(40, "MERGED", [])], landed=True, states={"review": {"decisions": [card()]}})
        self.assertEqual(verdict(d, [rep("review", "finished")]), {"review": "open"})

    def test_a_card_holds_only_the_stage_session_whose_file_has_it(self):
        # Each stage session has its own state file (CONTRACT.md): plan's card
        # doesn't hold review or done open.
        d = detail(["plan", "review", "done"], prs=[(40, "MERGED", [])], landed=True,
                   states={"plan": {"decisions": [card()]}})
        rows = {r["key"]: r for r in closing.sessions(d, [rep(k, "finished") for k in ("plan", "review", "done")])}
        self.assertEqual(rows["plan"]["reason"], "1 unanswered decision card")
        self.assertEqual((rows["review"]["status"], rows["done"]["status"]), ("closable", "closable"))

    def test_the_effort_files_leftovers_hold_no_stage_session(self):
        # state.json's cards reach a stage session only once routed to it
        # (state.route_stage_decisions, in the detail).
        d = detail(["review"], prs=[(40, "MERGED", [])], landed=True, state={"decisions": [card()]})
        self.assertEqual(verdict(d, [rep("review", "finished")]), {"review": "closable"})

    def test_closed_ones_say_so(self):
        d = detail(["build-t4"], tickets=[(4, "CLOSED")])
        rows = closing.sessions(d, [rep("build-t4", "finished")], {"build-t4": "2026-11-10T12:00:00Z"})
        self.assertEqual(rows[0]["status"], "closed")

    def test_unknown_keys_stay_open(self):
        self.assertEqual(verdict(detail(["something"], landed=True)), {"something": "open"})


class StageSessions(unittest.TestCase):
    def test_review_closes_when_the_prs_it_named_merged(self):
        d = detail(["review"], prs=[(31, "MERGED", [1]), (33, "MERGED", [2]), (39, "OPEN", [3])])
        rs = [rep("review", "started", items=["#31 https://x/pull/31", "#33 https://x/pull/33"]), rep("review", "finished")]
        row = closing.sessions(d, rs)[0]
        self.assertEqual(row["status"], "closable")
        self.assertIn("#31, #33 merged", row["reason"])

    def test_review_stays_while_a_pr_it_named_is_open(self):
        d = detail(["review"], prs=[(31, "MERGED", [1]), (39, "OPEN", [3])])
        self.assertEqual(verdict(d, [rep("review", "started", text="Reviewing #31 and #39"), rep("review", "finished")]),
                         {"review": "open"})

    def test_review_naming_no_pr_waits_for_everything_to_land(self):
        d = detail(["review"], prs=[(31, "OPEN", [1])])
        self.assertEqual(verdict(d, [rep("review", "finished")]), {"review": "open"})
        d = detail(["review"], prs=[(31, "MERGED", [1])], landed=True)
        self.assertEqual(verdict(d, [rep("review", "finished")]), {"review": "closable"})

    def test_shape_closes_when_decide_is_clear(self):
        self.assertEqual(verdict(detail(["shape"], decide=False), [rep("shape", "finished")]), {"shape": "closable"})
        self.assertEqual(verdict(detail(["shape"], decide=True), [rep("shape", "finished")]), {"shape": "open"})
        self.assertEqual(verdict(detail(["shape"], fog=2), [rep("shape", "finished")]), {"shape": "open"})

    def test_plan_closes_once_tickets_are_cut(self):
        self.assertEqual(verdict(detail(["plan"], deliver=3), [rep("plan", "finished")]), {"plan": "closable"})
        self.assertEqual(verdict(detail(["plan"]), [rep("plan", "finished")]), {"plan": "open"})
        self.assertEqual(verdict(detail(["plan"], deliver=3), [rep("plan", "asked")]), {"plan": "open"})

    def test_done_and_build_spec_close_once_landed(self):
        d = detail(["done", "build-spec"], landed=True)
        self.assertEqual(verdict(d, [rep("done", "finished"), rep("build-spec", "finished")]),
                         {"done": "closable", "build-spec": "closable"})
        d = detail(["done"], landed=False)
        self.assertEqual(verdict(d, [rep("done", "finished")]), {"done": "open"})


class SharedConversation(unittest.TestCase):
    """The hand-over continues the grilling's conversation: grill and plan are
    two keys on one slot. Closing grill's slot would close plan."""

    def shared(self, **kw):
        d = detail(["grill", "plan"], **kw)
        d["sessions"]["plan"] = d["sessions"]["grill"]
        return d

    def test_finished_grill_stays_open_while_plan_carries_on_in_its_conversation(self):
        d = self.shared(states={"plan": {"decisions": [card()]}})
        rows = {r["key"]: r for r in closing.sessions(d, [rep("grill", "finished"), rep("plan", "asked")])}
        self.assertEqual(rows["grill"]["status"], "open")
        self.assertIn("reported finished; every decision made", rows["grill"]["reason"])
        self.assertIn("its conversation carries on as plan", rows["grill"]["reason"])
        self.assertEqual(rows["plan"]["reason"], "1 unanswered decision card")

    def test_both_close_together_once_plan_is_done(self):
        d = self.shared(deliver=3)
        self.assertEqual(verdict(d, [rep("grill", "finished"), rep("plan", "finished")]),
                         {"grill": "closable", "plan": "closable"})


class Storage_(unittest.TestCase):
    def test_record_closed_and_reopen_clears_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = Storage(tmp)
            s.record_session("acme/widgets", 7, "build-t4", "slot")
            s.record_closed("acme/widgets", 7, ["build-t4"], "2026-11-10T12:00:00Z")
            self.assertEqual(s.get_closed("acme/widgets", 7), {"build-t4": "2026-11-10T12:00:00Z"})
            s.record_closed("acme/widgets", 7, ["build-t4"], "later")  # first close time kept
            self.assertEqual(s.get_closed("acme/widgets", 7), {"build-t4": "2026-11-10T12:00:00Z"})
            s.record_session("acme/widgets", 7, "build-t4", "slot")
            self.assertEqual(s.get_closed("acme/widgets", 7), {})


class Cli(unittest.TestCase):
    def test_sessions_prints_each_with_status(self):
        d = detail(["conductor", "build-t4"], tickets=[(4, "CLOSED")])
        d["closing"] = closing.sessions(d, [rep("build-t4", "finished")])
        svc = mock.MagicMock()
        svc.detail.return_value = d
        out = io.StringIO()
        with mock.patch.object(kipo_cli, "Initiatives", return_value=svc), mock.patch.object(kipo_cli, "Gh"), \
                mock.patch.object(kipo_cli, "Storage"), contextlib.redirect_stdout(out):
            code = kipo_cli.main(["sessions", "acme/widgets", "7"])
        self.assertEqual(code, 0)
        data = json.loads(out.getvalue())
        self.assertEqual((data["open"], data["closable"], data["closed"]), (1, 1, 0))
        self.assertEqual({r["key"]: r["status"] for r in data["sessions"]}, {"conductor": "open", "build-t4": "closable"})


if __name__ == "__main__":
    unittest.main()
