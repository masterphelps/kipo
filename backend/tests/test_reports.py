"""Stage sessions report to the conductor: reports.json, its read cursor, the
open decision cards rolled up for "Waiting on you", and the CLI around them."""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
from unittest import mock

from test_backend import REPO, Base, write_state

from kipo import reports
from kipo import state as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kipo_cli  # noqa: E402


def card(id_, answer=None):
    return {"id": id_, "title": f"Q {id_}", "options": ["A", "B"], "recommended": "A", "answer": answer}


class ReportFile(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_append_persists_with_increasing_ids(self):
        a = reports.append(self.tmp, 7, "shape", "nothing-to-do", "No fog to chart: all 3 items are tickets already.")
        b = reports.append(self.tmp, 7, "t41", "asked", "2 questions", items=["Pick auth?", "Keep sessions?"])
        self.assertEqual((a["id"], b["id"]), (1, 2))
        with open(os.path.join(self.tmp, ".kipo", "7", "reports.json")) as f:
            data = json.load(f)
        self.assertEqual([r["from"] for r in data["reports"]], ["shape", "t41"])
        self.assertEqual(data["reports"][1]["items"], ["Pick auth?", "Keep sessions?"])
        self.assertNotIn("items", data["reports"][0])

    def test_rejects_unknown_source_event_or_empty_text(self):
        for args in (("conductor", "started", "x"), ("t4x", "started", "x"), ("t4", "done", "x"), ("t4", "started", "  ")):
            with self.assertRaises(ValueError):
                reports.append(self.tmp, 7, *args)
        self.assertFalse(os.path.exists(reports.path(self.tmp, 7)))

    def test_unread_is_marked_read_once(self):
        reports.append(self.tmp, 7, "plan", "started", "Writing the spec.")
        reports.append(self.tmp, 7, "plan", "asked", "4 decisions")
        self.assertEqual(len(reports.take_unread(self.tmp, 7, mark=False)), 2)  # a peek
        self.assertEqual([r["id"] for r in reports.take_unread(self.tmp, 7)], [1, 2])
        self.assertEqual(reports.take_unread(self.tmp, 7), [])
        reports.append(self.tmp, 7, "plan", "finished", "Spec #50, 6 tickets.")
        self.assertEqual([r["event"] for r in reports.take_unread(self.tmp, 7)], ["finished"])
        self.assertEqual(reports.read(self.tmp, 7)["read"], 3)

    def test_no_file_means_nothing_unread(self):
        self.assertEqual(reports.take_unread(self.tmp, 7), [])
        self.assertEqual(reports.read(self.tmp, 7), {"reports": [], "read": 0})
        self.assertEqual(reports.read("", 7), {"reports": [], "read": 0})

    def test_ids_keep_rising_after_the_list_is_trimmed(self):
        with mock.patch.object(reports, "KEEP", 3):
            for i in range(5):
                reports.append(self.tmp, 7, "review", "pr-merged", f"PR #{i}")
            self.assertEqual([r["id"] for r in reports.read(self.tmp, 7)["reports"]], [3, 4, 5])
            reports.take_unread(self.tmp, 7)
            for i in range(4):
                reports.append(self.tmp, 7, "review", "pr-merged", f"PR #{i}")
            self.assertEqual([r["id"] for r in reports.take_unread(self.tmp, 7)], [7, 8, 9])

    def test_parallel_sessions_lose_nothing(self):
        def run(source):
            for i in range(25):
                reports.append(self.tmp, 7, source, "started", f"{source} {i}")
        threads = [threading.Thread(target=run, args=(s,)) for s in ("t1", "t2", "t3", "review")]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        got = reports.take_unread(self.tmp, 7)
        self.assertEqual(len(got), 100)
        self.assertEqual(sorted(r["id"] for r in got), list(range(1, 101)))

    def test_corrupt_file_starts_over(self):
        os.makedirs(st.state_dir(self.tmp, 7))
        with open(reports.path(self.tmp, 7), "w") as f:
            f.write("{nope")
        self.assertEqual(reports.append(self.tmp, 7, "done", "started", "Retro.")["id"], 1)


class OpenDecisions(unittest.TestCase):
    """Effort #995's shape: the plan session's 4 cards in state.json, ticket
    conversations' own files, and the conductor's own cards."""

    def detail(self):
        return {
            "sessions": {"conductor": "c", "shape": "s", "plan": "p", "shape-t1000": "x", "shape-t1007": "y"},
            "state": {"decisions": [card("seams"), card("held-store"), card("http-wording", "Fix it"), card("spec-approved")],
                      "blocking": "4 decisions on the spec"},
            "sessionStates": {
                "conductor": {"decisions": [card("handover")]},
                "shape-t1000": {"decisions": [card("look")]},  # its ticket is done
                "shape-t1007": {"decisions": [card("place", "Networks page"), card("who", "")], "blocking": None},
            },
            "frontier": {"tiles": [{"number": 1000, "state": "done"}, {"number": 1007, "state": "you"}]},
        }

    def test_rolls_up_every_open_session_card(self):
        got = [(d["from"], d["id"]) for d in reports.open_decisions(self.detail())]
        self.assertEqual(got, [("plan", "seams"), ("plan", "held-store"), ("plan", "spec-approved"), ("t1007", "who")])
        self.assertEqual(reports.open_decisions(self.detail())[0]["options"], ["A", "B"])

    def test_session_blocking(self):
        self.assertEqual(reports.session_blocking(self.detail()), [{"from": "plan", "blocking": "4 decisions on the spec"}])

    def test_effort_file_without_a_stage_session(self):
        self.assertEqual(reports.open_decisions({"state": {"decisions": [card("q")]}})[0]["from"], "effort")

    def test_a_recorded_view_is_not_an_open_question(self):
        # review-t664 wrote {id, view} into decisions — a settled view, no title,
        # no options, no answer key. It must not surface as waiting on the human
        # (in the page it crashed the question card outright).
        d = {"state": {"decisions": [{"id": "shared-address-coverage", "view": "Agree: names neither."}, card("q")]}}
        self.assertEqual([x["id"] for x in reports.open_decisions(d)], ["q"])


def rep(id_, source, event, items=None):
    r = {"id": id_, "at": f"2026-11-15T09:{id_:02d}:00Z", "from": source, "event": event, "text": "x"}
    if items:
        r["items"] = items
    return r


class StageDecisionsInTheEffortFile(unittest.TestCase):
    """Stage sessions seeded before each had its own file share state.json.
    Read-time only, its cards go to the session that asked them (its `asked`
    report lists `<id>: <title>`), else to the latest stage session still
    working; the file stays as written. Effort #1054: grill asked 20 and
    finished, the hand-over (plan) asked `seams` in the same file, review is open."""

    SESSIONS = {"conductor": "c", "grill": "g", "plan": "g", "review": "r"}

    def state(self):
        return {"summary": "Hand-over: writing the spec", "blocking": "the test seams",
                "decisions": [card("audience", "Assessor"), card("mockup-verdict", "Yes"), card("seams")],
                "artifacts": [{"label": "ADR", "href": "docs/adr/1.md"}], "skillsUsed": ["grilling", "to-spec"]}

    def reports(self):
        return [rep(1, "grill", "started"), rep(2, "grill", "asked", ["audience: Q audience"]),
                rep(3, "grill", "answered", ["audience: Assessor"]),
                rep(10, "grill", "asked", ["mockup-verdict: Q mockup-verdict"]), rep(13, "grill", "finished"),
                rep(14, "plan", "started"), rep(15, "plan", "asked", ["seams: Q seams"])]

    def test_cards_go_to_the_session_that_asked_them(self):
        state, states = st.route_stage_decisions(self.state(), {}, self.SESSIONS, self.reports())
        self.assertEqual([d["id"] for d in states["grill"]["decisions"]], ["audience", "mockup-verdict"])
        self.assertEqual([d["id"] for d in states["plan"]["decisions"]], ["seams"])
        self.assertNotIn("review", states)
        self.assertEqual(state["decisions"], [])

    def test_the_rest_goes_to_the_latest_stage_session_still_working(self):
        # No asked report names `seams`: plan started after grill finished, and
        # review never reported, so plan is the file's current writer.
        rs = [r for r in self.reports() if r["id"] != 15]
        state, states = st.route_stage_decisions(self.state(), {}, self.SESSIONS, rs)
        self.assertEqual([d["id"] for d in states["plan"]["decisions"]], ["seams"])
        self.assertEqual(states["plan"]["blocking"], "the test seams")
        self.assertEqual(states["plan"]["skillsUsed"], ["grilling", "to-spec"])
        self.assertNotIn("blocking", state)
        self.assertEqual(state["artifacts"], [{"label": "ADR", "href": "docs/adr/1.md"}])

    def test_blocking_goes_with_the_files_open_cards(self):
        # Review started after plan asked (and writes the same file), but the
        # file's blocking line is about plan's open card.
        rs = self.reports() + [rep(16, "review", "started", ["#1060 https://x/pull/1060"])]
        state, states = st.route_stage_decisions(self.state(), {}, self.SESSIONS, rs)
        self.assertEqual(states["plan"]["blocking"], "the test seams")
        self.assertEqual(states["plan"]["summary"], "Hand-over: writing the spec")
        self.assertFalse((states.get("review") or {}).get("blocking"))
        self.assertEqual(states["review"]["skillsUsed"], ["grilling", "to-spec"])

    def test_with_no_open_card_blocking_goes_to_the_current_writer(self):
        s = self.state()
        s["decisions"][-1]["answer"] = "Yes"
        rs = self.reports() + [rep(16, "review", "started")]
        _, states = st.route_stage_decisions(s, {}, self.SESSIONS, rs)
        self.assertEqual(states["review"]["blocking"], "the test seams")

    def test_a_session_with_its_own_file_keeps_it_first(self):
        own = {"plan": {"decisions": [card("own")], "blocking": "its own", "skillsUsed": []}}
        _, states = st.route_stage_decisions(self.state(), own, self.SESSIONS, self.reports())
        self.assertEqual([d["id"] for d in states["plan"]["decisions"]], ["own", "seams"])
        self.assertEqual(states["plan"]["blocking"], "its own")
        self.assertEqual(own["plan"]["decisions"], [card("own")])  # inputs unchanged

    def test_closed_sessions_dont_own_the_file(self):
        rs = [r for r in self.reports() if r["id"] != 15]
        _, states = st.route_stage_decisions(self.state(), {}, self.SESSIONS, rs, closed={"plan": "2026-11-15T10:00:00Z"})
        self.assertNotIn("seams", [d["id"] for d in (states.get("plan") or {}).get("decisions") or []])

    def test_without_reports_the_latest_stage_owns_it(self):
        _, states = st.route_stage_decisions(self.state(), {}, {"shape": "s", "plan": "p"}, [])
        self.assertEqual(len(states["plan"]["decisions"]), 3)

    def test_without_a_stage_session_the_file_stays_the_efforts(self):
        state, states = st.route_stage_decisions(self.state(), {}, {"conductor": "c"}, self.reports())
        self.assertEqual(len(state["decisions"]), 3)
        self.assertEqual(states, {})

    def test_frontier_waiting_names_plan(self):
        state, states = st.route_stage_decisions(self.state(), {}, self.SESSIONS, self.reports())
        d = {"sessions": self.SESSIONS, "state": state, "sessionStates": states, "frontier": {"tiles": []}}
        self.assertEqual([(x["from"], x["id"]) for x in reports.open_decisions(d)], [("plan", "seams")])
        self.assertEqual(reports.session_blocking(d), [{"from": "plan", "blocking": "the test seams"}])


class Cli(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.svc = mock.MagicMock()
        self.svc.detail.return_value = {
            "repoPath": self.tmp, "sessions": {"plan": "p"},
            "state": {"decisions": [card("spec-approved")]},
            "frontier": {"tiles": [{"number": 4, "title": "T4", "type": "build", "lane": "deliver", "state": "afk"}],
                         "fogItems": [], "fogLeft": []},
            "prs": [],
        }
        self.svc.repo_path.return_value = self.tmp
        self.patches = [mock.patch.object(kipo_cli, "Initiatives", return_value=self.svc),
                        mock.patch.object(kipo_cli, "Gh"), mock.patch.object(kipo_cli, "Storage")]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        shutil.rmtree(self.tmp)

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = kipo_cli.main(list(args))
        return code, out.getvalue(), err.getvalue()

    def report(self, *extra):
        return self.run_cli("report", REPO, "7", "--checkout", self.tmp, *extra)

    def test_report_persists_without_github(self):
        code, out, _ = self.report("--from", "shape", "--event", "nothing-to-do", "--text", "Nothing chartable yet.")
        self.assertEqual((code, json.loads(out)["entry"]["id"]), (0, 1))
        self.svc.repo_path.assert_not_called()
        self.svc.detail.assert_not_called()
        self.assertEqual(reports.read(self.tmp, 7)["reports"][0]["text"], "Nothing chartable yet.")

    def test_report_items_and_path_from_the_effort(self):
        code, _, _ = self.run_cli("report", REPO, "7", "--from", "plan", "--event", "asked", "--text", "2 decisions",
                                  "--item", "Publish the spec?", "--item", "One table or two?")
        self.assertEqual(code, 0)
        self.svc.repo_path.assert_called_once_with(REPO, 7)
        self.assertEqual(reports.read(self.tmp, 7)["reports"][0]["items"], ["Publish the spec?", "One table or two?"])

    def test_report_refuses_a_bad_source_or_event(self):
        self.assertEqual(self.report("--from", "conductor", "--event", "started", "--text", "x")[0], 2)
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            kipo_cli.main(["report", REPO, "7", "--from", "t4", "--event", "nope", "--text", "x"])

    def test_frontier_carries_unread_reports_and_waiting_cards(self):
        self.report("--from", "plan", "--event", "asked", "--text", "1 decision", "--item", "Publish the spec?")
        code, out, _ = self.run_cli("frontier", REPO, "7", "--peek")
        self.assertEqual(len(json.loads(out)["reports"]), 1)
        code, out, _ = self.run_cli("frontier", REPO, "7")
        data = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual([(r["from"], r["event"]) for r in data["reports"]], [("plan", "asked")])
        self.assertEqual([(d["from"], d["id"]) for d in data["waiting"]], [("plan", "spec-approved")])
        self.assertEqual(data["sessionsBlocking"], [])
        self.assertIn("threads", data)
        # Read once: the next wake doesn't relay it again; the open card stays until answered.
        data = json.loads(self.run_cli("frontier", REPO, "7")[1])
        self.assertEqual(data["reports"], [])
        self.assertEqual(len(data["waiting"]), 1)

    def test_reports_command(self):
        self.report("--from", "t4", "--event", "pr-opened", "--text", "PR #45 for #4", "--item", "#45")
        out = json.loads(self.run_cli("reports", REPO, "7", "--checkout", self.tmp, "--peek")[1])
        self.assertEqual(len(out["reports"]), 1)
        out = json.loads(self.run_cli("reports", REPO, "7", "--checkout", self.tmp)[1])
        self.assertEqual(out["reports"][0]["items"], ["#45"])
        self.assertEqual(json.loads(self.run_cli("reports", REPO, "7", "--checkout", self.tmp)[1])["reports"], [])


class Detail(Base):
    def test_detail_carries_reports_for_the_page(self):
        self.make_effort(column="plan", start="huge")
        reports.append(self.checkout, 7, "plan", "started", "Writing the spec.")
        status, d = self.app.dispatch("GET", f"/initiatives/{REPO}/7", "")
        self.assertEqual(status, 200, d)
        self.assertEqual(d["reports"]["read"], 0)
        self.assertEqual([r["text"] for r in d["reports"]["reports"]], ["Writing the spec."])

    def test_repo_path_from_the_effort(self):
        self.make_effort()
        self.assertEqual(self.app.initiatives.repo_path(REPO, 7), self.checkout)

    def test_dispatched_stage_seed_reports_as_its_stage(self):
        self.make_effort(start="huge")
        write_state(self.checkout, 7, {})
        status, out = self.app.dispatch("POST", f"/initiatives/{REPO}/7/session", json.dumps({"column": "shape"}))
        self.assertEqual(status, 200, out)
        self.assertIn(f"report {REPO} 7 --from shape --checkout {self.checkout} --event <kind>", out["seed"])


if __name__ == "__main__":
    unittest.main()
