"""The stall rule (kipo/stalls.py): which open stage sessions have stalled, as a
pure function of the effort detail, its reports, each session's activity and
the wakes sent; plus report attribution (kipo/closing.py), the I/O around it
(kipo/activity.py), and where it surfaces (the frontier, `kipo_cli.py`)."""
import contextlib
import datetime
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

from fakes import FakeGh  # noqa: F401  (puts the backend on sys.path)

from kipo import activity, closing, conductor, stalls
from kipo.storage import Storage

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kipo_cli  # noqa: E402

NOW = datetime.datetime(2026, 11, 10, 12, 50, tzinfo=datetime.timezone.utc)


def ago(minutes):
    return (NOW - datetime.timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def rep(id_, source, event, text="x", at=None, items=None):
    r = {"id": id_, "at": at or ago(60 - id_), "from": source, "event": event, "text": text}
    if items:
        r["items"] = items
    return r


def detail(sessions, tickets=(), prs=(), states=None, state=None, tiles=None):
    tiles = tiles if tiles is not None else [
        {"number": n, "state": "done" if s == "CLOSED" else "review", "title": f"T{n}", "type": "build",
         "lane": "deliver"} for n, s in tickets]
    return {
        "sessions": {k: f"kipo-acme-widgets-7-{k}" for k in sessions},
        "tickets": [{"number": n, "state": s} for n, s in tickets],
        "prs": [{"number": n, "state": s, "tickets": list(t)} for n, s, t in prs],
        "frontier": {"tiles": tiles, "landed": False, "fog": 0, "active": {"decide": False, "deliver": True},
                     "lanes": {"deliver": {"afk": 1}}},
        "state": state,
        "sessionStates": states or {},
    }


def stall_of(d, reports, act=None, wakes=None, closed=None, key="review-t4"):
    rows = stalls.sessions(d, reports, closed, act or {}, wakes or {}, NOW)
    return next(r for r in rows if r["key"] == key).get("stall")


IDLE = {"review-t4": {"at": ago(20), "running": False, "agent": True}}
BUSY = {"review-t4": {"at": ago(1), "running": False, "agent": True}}


class Attribution(unittest.TestCase):
    def test_old_report_goes_to_the_only_open_conversation(self):
        out = closing.attribute([rep(1, "t4", "started", at="2026-11-10T12:00:00Z")], {"review-t4": "s", "build-t4": "s"},
                                {"build-t4": "2026-11-10T11:00:00Z"})
        self.assertEqual(out[0]["session"], "review-t4")

    def test_old_report_goes_to_the_build_when_both_are_open(self):
        out = closing.attribute([rep(1, "t4", "finished", at="2026-11-10T12:00:00Z")], {"review-t4": "s", "build-t4": "s"},
                                {"build-t4": "2026-11-10T12:30:00Z"})
        self.assertEqual(out[0]["session"], "build-t4")

    def test_old_report_of_a_decision_ticket_goes_to_its_shape(self):
        self.assertEqual(closing.attribute([rep(1, "t9", "started")], {"shape-t9": "s"})[0]["session"], "shape-t9")

    def test_named_reports_keep_their_session(self):
        self.assertEqual(closing.attribute([rep(1, "review-t4", "blocked")], {})[0]["session"], "review-t4")

    def test_a_builds_old_finished_doesnt_make_the_review_look_finished(self):
        # #995: the build reported finished as t1024 while review-t1024 was open and blocked.
        d = detail(["build-t4", "review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
        rows = closing.sessions(d, [rep(1, "review-t4", "blocked"), rep(2, "t4", "finished")])
        review = next(r for r in rows if r["key"] == "review-t4")
        self.assertIn("last reported blocked", review["reason"])


class Idle(unittest.TestCase):
    d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])

    def test_idle_15_minutes_is_stalled(self):
        s = stall_of(self.d, [rep(1, "review-t4", "started")], IDLE)
        self.assertEqual((s["state"], s["why"], s["id"]), ("stalled", "idle 20 min", f"idle@{ago(20)}"))

    def test_recent_activity_is_not(self):
        self.assertIsNone(stall_of(self.d, [rep(1, "review-t4", "started")], BUSY))

    def test_mid_turn_is_never_stalled(self):
        act = {"review-t4": {"at": ago(90), "running": True, "agent": True}}
        self.assertIsNone(stall_of(self.d, [rep(1, "review-t4", "started")], act))

    def test_finished_or_nothing_to_do_is_not_stalled(self):
        for event in ("finished", "nothing-to-do"):
            self.assertIsNone(stall_of(self.d, [rep(1, "review-t4", event)], IDLE))

    def test_never_reported_is_left_alone(self):
        self.assertIsNone(stall_of(self.d, [], IDLE))

    def test_unknown_activity_is_not_idle(self):
        self.assertIsNone(stall_of(self.d, [rep(1, "review-t4", "started")], {}))

    def test_waiting_on_the_humans_cards_is_never_stalled(self):
        d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])],
                   states={"review-t4": {"decisions": [{"id": "q", "answer": None}]}})
        self.assertIsNone(stall_of(d, [rep(1, "review-t4", "asked")], IDLE))

    def test_asked_with_every_card_answered_can_stall(self):
        d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])],
                   states={"review-t4": {"decisions": [{"id": "q", "answer": "A"}]}})
        self.assertEqual(stall_of(d, [rep(1, "review-t4", "asked")], IDLE)["state"], "stalled")

    def test_a_settled_thread_is_not_stalled(self):
        d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "MERGED", [4])])
        self.assertIsNone(stall_of(d, [rep(1, "review-t4", "started")], IDLE))

    def test_the_conductor_is_never_stalled(self):
        d = detail(["conductor"])
        act = {"conductor": {"at": ago(90), "running": False}}
        self.assertIsNone(stall_of(d, [rep(1, "review-t4", "started")], act, key="conductor"))


class BlockerCleared(unittest.TestCase):
    d = detail(["build-t4", "review-t4"], tickets=[(4, "OPEN"), (6, "OPEN")], prs=[(40, "OPEN", [4]), (41, "MERGED", [6])])

    def test_another_session_on_the_ticket_finishing_clears_it(self):
        rs = [rep(1, "review-t4", "blocked", "the build is editing the worktree"), rep(2, "build-t4", "finished", "pushed")]
        s = stall_of(self.d, rs, BUSY)
        self.assertEqual((s["state"], s["id"]), ("stalled", "blocked#1"))
        self.assertTrue(s["why"].startswith("your blocker cleared: build-t4 reported finished"))

    def test_pr_opened_from_the_build_clears_it_too(self):
        rs = [rep(1, "review-t4", "blocked"), rep(2, "build-t4", "pr-opened", "PR #40 updated")]
        self.assertEqual(stall_of(self.d, rs, BUSY)["state"], "stalled")

    def test_an_old_style_report_from_the_build_clears_it(self):
        rs = [rep(1, "review-t4", "blocked"), rep(2, "t4", "finished")]
        self.assertEqual(stall_of(self.d, rs, BUSY)["state"], "stalled")

    def test_its_own_reports_dont_clear_it(self):
        rs = [rep(1, "review-t4", "blocked"), rep(2, "build-t5", "finished")]
        self.assertIsNone(stall_of(self.d, rs, BUSY))

    def test_a_named_pr_merged_report_clears_it(self):
        rs = [rep(1, "review-t4", "blocked", "waits on #77 (the CI fix)"), rep(2, "review", "pr-merged", "merged", items=["#77 url"])]
        s = stall_of(self.d, rs, BUSY)
        self.assertIn("#77 merged", s["why"])

    def test_a_named_merged_pr_or_closed_issue_on_github_clears_it(self):
        s = stall_of(self.d, [rep(1, "review-t4", "blocked", "waits on PR #41")], BUSY)
        self.assertIn("PR #41 merged", s["why"])
        d = detail(["review-t4"], tickets=[(4, "OPEN"), (6, "CLOSED")], prs=[(40, "OPEN", [4])])
        self.assertIn("#6 closed", stall_of(d, [rep(1, "review-t4", "blocked", "waits on #6")], BUSY)["why"])

    def test_its_own_ticket_and_pr_are_not_blockers(self):
        d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "MERGED", [4]), (42, "OPEN", [4])])
        self.assertIsNone(stall_of(d, [rep(1, "review-t4", "blocked", "#4: PR #40 is merged but #42 waits")], BUSY))

    def test_still_blocked_and_idle_falls_back_to_the_idle_timeout(self):
        s = stall_of(self.d, [rep(1, "review-t4", "blocked", "waits on #99")], IDLE)
        self.assertEqual(s["why"], "idle 20 min")

    def test_both_reasons_are_given(self):
        rs = [rep(1, "review-t4", "blocked"), rep(2, "build-t4", "finished", "pushed")]
        s = stall_of(self.d, rs, IDLE)
        self.assertEqual(s["id"], "blocked#1")
        self.assertTrue(s["why"].endswith("; idle 20 min"))


class Wakes(unittest.TestCase):
    d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
    rs = [rep(1, "review-t4", "started", at=ago(60))]

    def test_woken_once_per_stall(self):
        wakes = {"review-t4": [{"at": ago(1), "stall": f"idle@{ago(20)}", "why": "idle 19 min"}]}
        s = stall_of(self.d, self.rs, IDLE, wakes)
        self.assertEqual(s["state"], "woken")

    def test_an_unanswered_wake_then_idle_again_is_a_new_stall(self):
        # The wake is the session's last message (not the agent's), 16 min ago.
        wakes = {"review-t4": [{"at": ago(16), "stall": f"idle@{ago(40)}", "why": "idle 24 min"}]}
        act = {"review-t4": {"at": ago(16), "running": False, "agent": False}}
        s = stall_of(self.d, self.rs, act, wakes)
        self.assertEqual((s["state"], s["id"]), ("stalled", f"idle@{ago(16)}"))

    def test_two_unanswered_wakes_make_it_stuck(self):
        wakes = {"review-t4": [{"at": ago(40), "stall": "idle@a", "why": "idle 20 min"},
                               {"at": ago(20), "stall": "idle@b", "why": "idle 20 min"}]}
        act = {"review-t4": {"at": ago(20), "running": False, "agent": False}}
        s = stall_of(self.d, self.rs, act, wakes)
        self.assertEqual(s["state"], "stuck")

    def test_a_report_after_a_wake_answers_it(self):
        wakes = {"review-t4": [{"at": ago(40), "stall": "idle@a", "why": "x"}, {"at": ago(20), "stall": "idle@b", "why": "x"}]}
        rs = self.rs + [rep(2, "review-t4", "blocked", "waits on #99", at=ago(19))]
        act = {"review-t4": {"at": ago(19), "running": False, "agent": True}}
        self.assertEqual(stall_of(self.d, rs, act, wakes)["state"], "stalled")  # idle 19 min: a new stall

    def test_agent_activity_after_a_wake_answers_it(self):
        wakes = {"review-t4": [{"at": ago(10), "stall": "idle@a", "why": "x"}]}
        act = {"review-t4": {"at": ago(5), "running": False, "agent": True}}
        self.assertIsNone(stall_of(self.d, self.rs, act, wakes))

    def test_transcript_activity_within_the_grace_is_the_wake_itself(self):
        wakes = {"review-t4": [{"at": ago(10), "stall": "idle@a", "why": "x"}]}
        act = {"review-t4": {"at": ago(10), "running": None, "agent": None}}
        self.assertEqual(stall_of(self.d, self.rs, act, wakes)["state"], "woken")
        self.assertEqual(stalls.unanswered(wakes["review-t4"], self.rs, act["review-t4"]), 1)


class Surfaces(unittest.TestCase):
    def _detail(self, act, wakes=None):
        d = detail(["build-t4", "review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
        d["frontier"]["tiles"][0]["state"] = "review"
        rs = [rep(1, "build-t4", "finished"), rep(2, "review-t4", "started")]
        d["closing"] = stalls.sessions(d, rs, None, act, wakes or {}, NOW)
        return d

    def test_a_stalled_tickets_thread_is_owned_by_stalled(self):
        th = conductor.threads(self._detail(IDLE))["threads"][0]
        self.assertEqual((th["owner"], th["session"], th["stall"]), ("Stalled", "review-t4", "stalled"))
        self.assertIn("idle 20 min", th["action"])

    def test_without_a_stall_the_thread_is_as_before(self):
        self.assertEqual(conductor.threads(self._detail(BUSY))["threads"][0]["owner"], "Agent")

    def test_stuck_sessions_become_cards(self):
        wakes = {"review-t4": [{"at": ago(40), "stall": "a", "why": "x"}, {"at": ago(20), "stall": "b", "why": "idle 20 min"}]}
        act = {"review-t4": {"at": ago(20), "running": False, "agent": False}}
        cards = stalls.stuck_cards(self._detail(act, wakes)["closing"])
        self.assertEqual([(c["from"], c["id"], c["stuck"]) for c in cards], [("review-t4", "stuck-review-t4", True)])
        # The human can have it replaced: the conductor re-dispatches its thread.
        self.assertEqual(cards[0]["recommended"], "Dispatch a fresh session")
        self.assertIn("Dispatch a fresh session", cards[0]["options"])

    def test_cli_counts_stalled_woken_stuck(self):
        d = self._detail(IDLE)
        svc = mock.MagicMock()
        svc.detail.return_value = d
        out = io.StringIO()
        with mock.patch.object(kipo_cli, "Initiatives", return_value=svc), mock.patch.object(kipo_cli, "Gh"), \
                mock.patch.object(kipo_cli, "Storage"), contextlib.redirect_stdout(out):
            self.assertEqual(kipo_cli.main(["sessions", "acme/widgets", "7"]), 0)
        data = json.loads(out.getvalue())
        self.assertEqual((data["stalled"], data["woken"], data["stuck"]), (1, 0, 0))
        row = next(r for r in data["sessions"] if r["key"] == "review-t4")
        self.assertEqual(row["stall"]["state"], "stalled")


class Effort995(unittest.TestCase):
    """The two stalls of 2026-11-10 on interroseclabs/netsight#995, replayed."""

    def test_review_t1024_is_stalled_by_its_cleared_blocker_and_by_idling(self):
        d = detail(["build-t1024", "review-t1024", "conductor"], tickets=[(1024, "OPEN"), (1023, "CLOSED")],
                   prs=[(1041, "OPEN", [1024]), (1040, "MERGED", [1023])])
        rs = [
            {"id": 19, "at": "2026-11-10T10:59:37Z", "from": "t1024", "event": "started", "text": "Building #1024"},
            {"id": 32, "at": "2026-11-10T11:58:03Z", "from": "t1024", "event": "pr-opened", "text": "PR #1041 closes #1024"},
            {"id": 33, "at": "2026-11-10T11:58:03Z", "from": "t1024", "event": "finished", "text": "#1024 built"},
            {"id": 34, "at": "2026-11-10T12:00:13Z", "from": "review-t1024", "event": "started", "text": "Reviewing PR #1041"},
            {"id": 35, "at": "2026-11-10T12:04:37Z", "from": "review-t1024", "event": "blocked",
             "text": "Another session is editing worktree kipo/995-t1024 while review-t1024 holds it",
             "items": ["#1041 url", "customerBatch never sent refused rows after #1040"]},
            {"id": 36, "at": "2026-11-10T12:12:02Z", "from": "t1024", "event": "pr-opened", "text": "PR #1041 updated"},
            {"id": 37, "at": "2026-11-10T12:12:02Z", "from": "t1024", "event": "finished", "text": "#1024 built; CI green"},
        ]
        act = {"review-t1024": {"at": "2026-11-10T12:04:48Z", "running": False, "agent": True}}
        rows = {r["key"]: r for r in stalls.sessions(d, rs, {"build-t1024": "2026-11-10T12:42:29Z"}, act, {}, NOW)}
        s = rows["review-t1024"]["stall"]
        self.assertEqual((s["state"], s["id"]), ("stalled", "blocked#35"))
        self.assertIn("build-t1024 reported finished", s["why"])
        self.assertIn("idle 45 min", s["why"])
        self.assertNotIn("stall", rows["conductor"])

    def test_build_t1024_writing_then_stopping_is_stalled_by_idling(self):
        d = detail(["build-t1024"], tickets=[(1024, "OPEN")], prs=[(1041, "OPEN", [1024])])
        rs = [{"id": 19, "at": "2026-11-10T10:59:37Z", "from": "t1024", "event": "started", "text": "Building #1024"}]
        act = {"build-t1024": {"at": "2026-11-10T11:13:00Z", "running": False, "agent": True}}
        now = datetime.datetime(2026, 11, 10, 11, 53, tzinfo=datetime.timezone.utc)
        row = stalls.sessions(d, rs, None, act, {}, now)[0]
        self.assertEqual((row["stall"]["state"], row["stall"]["why"]), ("stalled", "idle 40 min"))


def dispatched(d, *entries, starts=None):
    """``d`` with the conductor's dispatch queue and KiPo's recorded starts."""
    d = dict(d)
    d["sessionStates"] = {**(d.get("sessionStates") or {}), "conductor": {"dispatch": list(entries)}}
    if starts is not None:
        d["starts"] = starts
    return d


class NeverReported(unittest.TestCase):
    """Every session KiPo dispatches today is seeded to report: one that never
    did is a stall candidate. Only a session from before reporting (no dispatch
    entry, no recorded start) is left alone."""

    base = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])

    def test_a_dispatched_ticket_session_that_never_reported_stalls(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(60)})
        s = stall_of(d, [], IDLE)
        self.assertEqual((s["state"], s["id"]), ("stalled", f"idle@{ago(20)}"))
        self.assertIn("never reported", s["why"])

    def test_a_session_kipo_recorded_starting_that_never_reported_stalls(self):
        d = dispatched(self.base, starts={"review-t4": {"at": ago(60), "slot": "kipo-acme-widgets-7-review-t4"}})
        self.assertEqual(stall_of(d, [], IDLE)["state"], "stalled")

    def test_a_pre_reporting_session_is_still_left_alone(self):
        # Dispatched for another thread; this one has no entry and no recorded start.
        d = dispatched(self.base, {"ticket": 9, "at": ago(60)})
        self.assertIsNone(stall_of(d, [], IDLE))

    def test_with_no_activity_known_it_idles_from_its_dispatch(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(60)})
        s = stall_of(d, [], {})
        self.assertEqual(s["state"], "stalled")
        self.assertIn("idle 60 min", s["why"])

    def test_recently_dispatched_is_not_yet_idle(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(5)})
        self.assertIsNone(stall_of(d, [], {}))

    def test_close_rule_agrees_it_is_not_finished(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(60)})
        row = closing.sessions(d, [])[0]
        self.assertEqual(row["status"], "open")
        self.assertIn("never reported since it was dispatched", row["reason"])
        self.assertNotIn("started before reporting", row["reason"])

    def test_close_rule_still_closes_it_once_its_thread_settled(self):
        d = dispatched(detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "MERGED", [4])]),
                       {"ticket": 4, "skill": "kipo-review", "at": ago(60)})
        row = closing.sessions(d, [])[0]
        self.assertEqual(row["status"], "closable")
        self.assertIn("never reported", row["reason"])

    def test_a_shape_ticket_dispatched_under_its_skill_counts(self):
        d = dispatched(detail(["shape-t9"], tickets=[(9, "OPEN")],
                              tiles=[{"number": 9, "state": "you", "type": "grilling", "lane": "decide"}]),
                       {"ticket": 9, "skill": "kipo-grill", "at": ago(60)})
        act = {"shape-t9": {"at": ago(40), "running": False, "agent": True}}
        self.assertEqual(stall_of(d, [], act, key="shape-t9")["state"], "stalled")


class SeededToReport(unittest.TestCase):
    """A session with no dispatch entry and no recorded start (the page opened
    it before KiPo kept starts) whose seed carried a Report line: it was seeded
    to report, so never reporting is idling, not "started before reporting"."""

    base = detail(["build-t4"], tickets=[(4, "OPEN")])
    act = {"build-t4": {"at": ago(40), "running": False, "agent": True}}

    def seeded(self, reports=True):
        return {**self.base, "seeds": {"build-t4": {"at": ago(60), "reports": reports}}}

    def test_a_seed_with_a_report_line_makes_silence_a_stall(self):
        s = stall_of(self.seeded(), [], self.act, key="build-t4")
        self.assertEqual((s["state"], s["id"]), ("stalled", f"idle@{ago(40)}"))
        self.assertIn("never reported since its seed asked it to report", s["why"])

    def test_the_close_rule_agrees(self):
        row = closing.sessions(self.seeded(), [])[0]
        self.assertEqual(row["status"], "open")
        self.assertNotIn("started before reporting", row["reason"])
        self.assertIn("never reported since its seed asked it to report", row["reason"])

    def test_a_seed_without_a_report_line_is_left_alone(self):
        self.assertIsNone(stall_of(self.seeded(reports=False), [], self.act, key="build-t4"))
        self.assertIn("started before reporting", closing.sessions(self.seeded(reports=False), [])[0]["reason"])

    def test_no_activity_known_idles_from_the_seed(self):
        s = stall_of(self.seeded(), [], {}, key="build-t4")
        self.assertIn("idle 60 min", s["why"])


class Effort1054(unittest.TestCase):
    """interroseclabs/netsight#1054, 2026-11-15: KiPo's page started build-t1062
    at 18:05Z (its seed had a Report line; no dispatch entry, no starts.json);
    it last moved at 18:25Z and never reported. 14 hours later `sessions` still
    read it "never reported (started before reporting)", with no stall."""

    def test_build_t1062_is_stalled(self):
        d = detail(["conductor", "build-t1062"], tickets=[(1062, "OPEN")])
        d["seeds"] = {"build-t1062": {"at": "2026-11-15T18:05:18.424Z", "reports": True}}
        act = {"build-t1062": {"at": "2026-11-15T18:25:38.665053+00:00", "running": False, "agent": True}}
        now = datetime.datetime(2026, 11, 16, 8, 30, tzinfo=datetime.timezone.utc)
        row = next(r for r in stalls.sessions(d, [], None, act, {}, now) if r["key"] == "build-t1062")
        self.assertEqual(row["stall"]["state"], "stalled")
        self.assertEqual(row["stall"]["id"], "idle@2026-11-15T18:25:38.665053+00:00")
        self.assertIn("idle 844 min", row["stall"]["why"])


class IdleClock(unittest.TestCase):
    """Idle counts from the session's newest sign of life: its activity, its
    latest report (any event), or its state file's latest write. #1054,
    2026-11-15: plan read "stalled, idle 25 min" a minute after reporting."""

    d = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
    stale = {"review-t4": {"at": ago(112), "running": False, "agent": True}}

    def test_a_fresh_report_resets_the_clock(self):
        self.assertIsNone(stall_of(self.d, [rep(1, "review-t4", "asked", at=ago(1))], self.stale))

    def test_a_fresh_state_write_resets_the_clock(self):
        d = {**self.d, "stateWrites": {"review-t4": ago(2)}}
        self.assertIsNone(stall_of(d, [rep(1, "review-t4", "started", at=ago(50))], self.stale))

    def test_the_stall_id_and_minutes_come_from_the_newest(self):
        d = {**self.d, "stateWrites": {"review-t4": ago(30)}}
        s = stall_of(d, [rep(1, "review-t4", "started", at=ago(20))], self.stale)
        self.assertEqual((s["state"], s["id"], s["why"]), ("stalled", f"idle@{ago(20)}", "idle 20 min"))

    def test_another_sessions_report_doesnt_reset_it(self):
        s = stall_of(self.d, [rep(1, "review-t4", "started", at=ago(50)), rep(2, "build-t4", "started", at=ago(1))],
                     self.stale)
        self.assertEqual(s["id"], f"idle@{ago(50)}")


class Effort201(unittest.TestCase):
    """interroseclabs/qsight#201, 2026-11-14: `dispatch --stage review` at 09:47Z
    opened the review session; it never reported, and the stall rule skipped it
    for ~18 hours while three docs-only PRs (#609, #611, #612, "(#208)" in their
    titles, no closing keyword) waited."""

    def _detail(self):
        d = detail(["conductor", "shape-t208", "shape-t212", "review", "plan"],
                   tickets=[(208, "CLOSED"), (212, "OPEN")], prs=[],
                   tiles=[{"number": 208, "state": "done", "type": "grilling", "lane": "decide"},
                          {"number": 212, "state": "you", "type": "task", "lane": "decide"}])
        d["frontier"].update(landed=False, active={"decide": True, "deliver": False})
        d["refPrs"] = [{"number": n, "state": "OPEN", "tickets": [], "refs": [208], "title": f"ADR (#208) {n}"}
                       for n in (609, 611, 612)]
        return dispatched(d, {"ticket": 212, "skill": "kipo-shape", "at": "2026-11-14T09:13:49Z"},
                          {"stage": "review", "at": "2026-11-14T09:47:20Z"})

    def test_the_review_session_is_stalled(self):
        now = datetime.datetime(2026, 11, 15, 3, 47, tzinfo=datetime.timezone.utc)
        act = {"review": {"at": "2026-11-14T09:48:00Z", "running": False, "agent": True}}
        rows = {r["key"]: r for r in stalls.sessions(self._detail(), [], None, act, {}, now)}
        self.assertEqual(rows["review"]["status"], "open")
        self.assertEqual(rows["review"]["stall"]["state"], "stalled")
        self.assertIn("idle 1079 min", rows["review"]["stall"]["why"])

    def test_shape_t212_silent_for_40_minutes_is_stalled(self):
        now = datetime.datetime(2026, 11, 14, 9, 55, tzinfo=datetime.timezone.utc)
        act = {"shape-t212": {"at": "2026-11-14T09:14:30Z", "running": False, "agent": True}}
        rows = {r["key"]: r for r in stalls.sessions(self._detail(), [], None, act, {}, now)}
        self.assertEqual(rows["shape-t212"]["stall"]["state"], "stalled")


class Replaced(unittest.TestCase):
    """A re-dispatched thread: its fresh session starts clean of the old one's
    reports, wakes and activity; the old slot, while the replacement is
    pending, is closable."""

    base = detail(["review-t4"], tickets=[(4, "OPEN")], prs=[(40, "OPEN", [4])])
    old_wakes = {"review-t4": [{"at": ago(50), "stall": "idle@a", "why": "x"}, {"at": ago(30), "stall": "idle@b", "why": "x"}]}

    def test_the_old_session_was_stuck(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(70)})
        act = {"review-t4": {"at": ago(30), "running": False, "agent": False}}
        self.assertEqual(stall_of(d, [], act, self.old_wakes)["state"], "stuck")

    def test_a_pending_replacement_makes_the_old_one_closable(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(70)},
                       {"ticket": 4, "skill": "kipo-review", "at": ago(1), "replace": "kipo-acme-widgets-7-review-t4"})
        row = closing.sessions(d, [])[0]
        self.assertEqual(row["status"], "closable")
        self.assertIn("replaced", row["reason"])

    def test_the_fresh_session_ignores_the_old_ones_wakes_and_reports(self):
        d = dispatched(self.base, {"ticket": 4, "skill": "kipo-review", "at": ago(70)},
                       {"ticket": 4, "skill": "kipo-review", "at": ago(3), "replace": "kipo-acme-widgets-7-review-t4"},
                       starts={"review-t4": {"at": ago(2), "slot": "kipo-acme-widgets-7-review-t4-r2",
                                             "replaced": ["kipo-acme-widgets-7-review-t4"]}})
        d["sessions"] = {"review-t4": "kipo-acme-widgets-7-review-t4-r2"}
        old = [rep(1, "review-t4", "blocked", "waits on #99", at=ago(65))]
        act = {"review-t4": {"at": ago(30), "running": False, "agent": False}}  # the old slot's, before the start
        rows = stalls.sessions(d, old, None, act, self.old_wakes, NOW)
        self.assertEqual(rows[0]["status"], "open")
        self.assertNotIn("stall", rows[0])
        self.assertIn("never reported", rows[0]["reason"])


class Io(unittest.TestCase):
    def test_record_wake_once_per_stall(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = activity.record_wake(tmp, 7, "review-t4", "blocked#3", "why", clock=lambda: "2026-11-10T12:00:00Z")
            b = activity.record_wake(tmp, 7, "review-t4", "blocked#3", "again", clock=lambda: "2026-11-10T12:05:00Z")
            activity.record_wake(tmp, 7, "review-t4", "idle@x", "idle", clock=lambda: "2026-11-10T12:30:00Z")
            self.assertEqual(a, b)
            self.assertEqual([w["stall"] for w in activity.read_wakes(tmp, 7)["review-t4"]], ["blocked#3", "idle@x"])
            self.assertTrue(os.path.exists(os.path.join(tmp, ".kipo", "7", "wakes.json")))

    def test_observations_are_used_while_fresh_else_the_transcript(self):
        observed = {"a": {"at": ago(30), "running": True, "agent": True, "seen": ago(1)},
                    "b": {"at": ago(30), "running": True, "agent": True, "seen": ago(10)}}
        fallback = {"b": {"at": ago(3), "running": None, "agent": None}}
        out = activity.merge(observed, fallback, NOW)
        self.assertEqual(out["a"]["running"], True)
        self.assertEqual(out["b"], fallback["b"])

    def test_transcript_activity_reads_the_session_map(self):
        with tempfile.TemporaryDirectory() as tmp:
            home, claude = os.path.join(tmp, "crew"), os.path.join(tmp, "claude")
            os.makedirs(home)
            folder = os.path.join(claude, "projects", "-x-y--crew-workspace")
            os.makedirs(folder)
            with open(os.path.join(home, "session_map.json"), "w") as fh:
                json.dump({"dashboard:slot-a": {"sid": "abc", "cwd": "/x/y/.crew/workspace"}}, fh)
            p = os.path.join(folder, "abc.jsonl")
            open(p, "w").close()
            os.utime(p, (1762779000, 1762779000))
            out = activity.transcript_activity({"review-t4": "slot-a", "gone": "slot-b"}, home=home, claude_home=claude)
            self.assertEqual(out, {"review-t4": {"at": "2025-11-10T12:50:00Z", "running": None, "agent": None}})

    def test_transcript_seeds_read_the_first_user_message(self):
        with tempfile.TemporaryDirectory() as tmp:
            home, claude = os.path.join(tmp, "crew"), os.path.join(tmp, "claude")
            os.makedirs(home)
            folder = os.path.join(claude, "projects", "-x-y--crew-workspace")
            os.makedirs(folder)
            with open(os.path.join(home, "session_map.json"), "w") as fh:
                json.dump({f"dashboard:slot-{k}": {"sid": k, "cwd": "/x/y/.crew/workspace"} for k in "abc"}, fh)
            seed = ("[AGENT SYSTEM PROMPT]\n...\nConversation: build-t4\n"
                    "Report: python3 /k/backend/kipo_cli.py report acme/widgets 7 --from build-t4 --event <kind>\n")
            lines = {
                "a": [{"type": "system"}, {"type": "user", "timestamp": "2026-11-15T18:05:18.424Z",
                                            "message": {"content": [{"type": "text", "text": seed}]}},
                      {"type": "user", "message": {"content": "Report: kipo_cli.py report later"}}],
                "b": [{"type": "user", "timestamp": "2026-11-01T09:00:00Z",
                       "message": {"content": "Conversation: build-t5\nno report line"}}],
            }
            for sid, rows in lines.items():
                with open(os.path.join(folder, f"{sid}.jsonl"), "w") as fh:
                    fh.write("\n".join(json.dumps(r) for r in rows) + "\n")
            out = activity.transcript_seeds({"build-t4": "slot-a", "build-t5": "slot-b", "gone": "slot-c"},
                                            home=home, claude_home=claude)
            self.assertEqual(out, {"build-t4": {"at": "2026-11-15T18:05:18.424Z", "reports": True},
                                   "build-t5": {"at": "2026-11-01T09:00:00Z", "reports": False}})

    def test_clean_observation(self):
        self.assertEqual(activity.clean_observation({"at": "t", "running": "yes", "agent": False}),
                         {"at": "t", "running": None, "agent": False})
        self.assertIsNone(activity.clean_observation("nope"))

    def test_storage_keeps_activity_with_when_seen(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = Storage(tmp)
            s.record_activity("acme/widgets", 7, {"review-t4": {"at": "t", "running": False, "agent": True}}, "seen")
            self.assertEqual(s.get_activity("acme/widgets", 7)["review-t4"]["seen"], "seen")


if __name__ == "__main__":
    unittest.main()
