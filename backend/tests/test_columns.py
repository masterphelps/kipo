"""Columns and paths, advance, the review gate, sessions, the skill endpoint, tickets and PRs, docs."""
import json
import os
import unittest

from test_backend import REPO, Base, write_state

from kipo import COLUMNS, PATHS, SKILLS, SKILLS_DIR, run_line
from kipo import initiatives as ini
from kipo import reports as col_reports
from kipo import state as st

DONE = {"gate": [{"id": "g", "label": "Done", "done": True}]}
RUN = "Run /{s}: read " + SKILLS_DIR + "/{s}/SKILL.md (and any file it links to) and follow it now, for this effort."


class Columns(Base):
    def post(self, path, body="{}", n=7):
        return self.app.dispatch("POST", f"/initiatives/{REPO}/{n}{path}", body if isinstance(body, str) else json.dumps(body))

    def get(self, path="", n=7):
        return self.app.dispatch("GET", f"/initiatives/{REPO}/{n}{path}", "")

    def ticket(self, number, n=7, state="OPEN", title=None):
        self.fake.add_issue(REPO, number, title=title or f"Ticket {number}", labels=[f"kipo:{n}"], state=state)
        return number

    def cols(self, number=7):
        return sorted(l for l in self.fake.label_set(REPO, number) if l.startswith("kipo:col:"))


class ConstantsTests(unittest.TestCase):
    def test_twenty_seven_skills(self):
        self.assertEqual(len(SKILLS), 27)
        self.assertEqual(COLUMNS, ("intake", "shape", "grill", "plan", "build", "review", "done"))

    def test_run_line(self):
        self.assertEqual(run_line("to-spec"), RUN.format(s="to-spec"))


class CreateTests(Columns):
    EXPECTED = {
        "idea": ["grill", "plan", "build", "review", "done"],
        "small": ["grill", "build", "review", "done"],
        "huge": ["shape", "plan", "build", "review", "done"],
        "issue": ["intake", "build", "review", "done"],
        "bug": ["build", "review", "done"],
    }

    def test_every_start_point(self):
        for start, path in self.EXPECTED.items():
            payload = {"repo": REPO, "destination": f"Do {start}.", "start": start}
            if start == "issue":
                payload["sourceIssue"] = 3
            status, out = self.app.dispatch("POST", "/initiatives", json.dumps(payload))
            self.assertEqual(status, 200, out)
            self.assertEqual((out["start"], out["path"], out["column"]), (start, path, path[0]), start)
            self.assertEqual(
                self.fake.label_set(REPO, out["number"]),
                {"kipo:effort", f"kipo:col:{path[0]}", f"kipo:start:{start}"},
            )
            meta = ini.parse_body(self.fake.issues[(REPO, out["number"])]["body"])["meta"]
            self.assertEqual((meta["start"], meta["path"]), (start, path))
            self.assertEqual(meta["sourceIssue"], 3 if start == "issue" else None)
            for label in ("kipo:effort", f"kipo:col:{path[0]}", f"kipo:start:{start}"):
                self.assertIn((REPO, label), self.fake.labels)

    def test_default_start_is_idea(self):
        status, out = self.app.dispatch("POST", "/initiatives", json.dumps({"repo": REPO, "destination": "x"}))
        self.assertEqual((status, out["start"]), (200, "idea"))

    def test_bad_start(self):
        status, out = self.app.dispatch("POST", "/initiatives", json.dumps({"repo": REPO, "destination": "x", "start": "foggy"}))
        self.assertEqual((status, out["code"]), (400, "invalid_start"))


class AdvanceTests(Columns):
    def test_along_the_path(self):
        n = self.make_effort(start="idea", artifacts=[{"label": "Brief", "href": "docs/brief.md"}])
        expected = ["plan", "build", "review"]
        for target in expected:
            write_state(self.checkout, n, {**DONE, "artifacts": [{"label": "Map", "href": f"https://x/{target}"}]})
            status, d = self.post("/advance")
            self.assertEqual(status, 200, d)
            self.assertEqual(d["column"], target)
            self.assertEqual(self.cols(), [f"kipo:col:{target}"])
            self.assertIn((REPO, f"kipo:col:{target}"), self.fake.labels)
        self.assertEqual(d["phaseLog"][1:], ["2026-11-06 grill → plan", "2026-11-06 plan → build", "2026-11-06 build → review"])
        self.assertEqual(len(d["artifacts"]), 4)

    def test_off_path_columns_are_skipped(self):
        n = self.make_effort(start="issue")
        write_state(self.checkout, n, DONE)
        status, d = self.post("/advance")
        self.assertEqual((status, d["column"]), (200, "build"))

    def test_gate(self):
        n = self.make_effort()
        write_state(self.checkout, n, {"gate": [{"id": "g", "done": False}]})
        status, out = self.post("/advance", {"force": False})
        self.assertEqual((status, out["code"]), (409, "gate_not_passed"))
        self.assertEqual(self.cols(), ["kipo:col:grill"])
        self.assertTrue(os.path.exists(st.state_path(self.checkout, n)))
        status, d = self.post("/advance", {"force": True})
        self.assertEqual((status, d["column"]), (200, "plan"))

    def test_to_jumps_and_rewrites_the_path(self):
        n = self.make_effort(start="issue")
        status, d = self.post("/advance", {"force": True, "to": "plan"})
        self.assertEqual(status, 200, d)
        self.assertEqual((d["column"], d["path"]), ("plan", ["intake", "plan", "build", "review", "done"]))
        self.assertEqual(self.cols(), ["kipo:col:plan"])
        meta = ini.parse_body(self.fake.issues[(REPO, n)]["body"])["meta"]
        self.assertEqual(meta["path"], ["intake", "plan", "build", "review", "done"])

        status, d = self.post("/advance", {"force": True, "to": "review"})
        self.assertEqual((d["column"], d["path"]), ("review", ["intake", "plan", "review", "done"]))

    def test_to_must_be_later(self):
        self.make_effort(start="idea", column="build")
        for to in ("grill", "build", "nope"):
            status, out = self.post("/advance", {"force": True, "to": to})
            self.assertEqual((status, out["code"]), (400, "invalid_column"), to)

    def test_archive_and_history(self):
        n = self.make_effort()
        write_state(self.checkout, n, {**DONE, "summary": "Grilled."})
        status, d = self.post("/advance")
        self.assertEqual(status, 200, d)
        self.assertFalse(os.path.exists(st.state_path(self.checkout, n)))
        self.assertTrue(os.path.exists(os.path.join(st.state_dir(self.checkout, n), "state.grill.json")))
        self.assertIsNone(d["state"])
        self.assertFalse(d["gatePassed"])
        self.assertEqual(d["history"]["grill"]["summary"], "Grilled.")

    def test_history_only_reports_earlier_columns(self):
        n = self.make_effort(column="plan")
        folder = st.state_dir(self.checkout, n)
        os.makedirs(folder)
        for column in ("grill", "build"):
            with open(os.path.join(folder, f"state.{column}.json"), "w") as f:
                json.dump({"column": column}, f)
        self.assertEqual(set(self.get()[1]["history"]), {"grill"})

    def test_leaving_done_closes_the_issue(self):
        n = self.make_effort(column="done")
        write_state(self.checkout, n, DONE)
        status, d = self.post("/advance")
        self.assertEqual(status, 200, d)
        self.assertEqual(self.fake.issues[(REPO, n)]["state"], "CLOSED")
        self.assertEqual(d["phaseLog"][-1], "2026-11-06 done → closed")
        self.assertTrue(os.path.exists(os.path.join(st.state_dir(self.checkout, n), "state.done.json")))
        status, out = self.post("/advance", {"force": True})
        self.assertEqual((status, out["code"]), (409, "effort_closed"))

    def test_not_an_effort(self):
        self.fake.add_issue(REPO, 99, labels=["bug"])
        status, payload = self.get(n=99)
        self.assertEqual((status, payload["code"]), (404, "not_effort"))


class ReviewGateTests(Columns):
    def setUp(self):
        super().setUp()
        self.make_effort(column="review")
        self.ticket(20)

    def test_no_pr_fails(self):
        self.assertFalse(self.get()[1]["gatePassed"])
        status, out = self.post("/advance")
        self.assertEqual((status, out["code"]), (409, "gate_not_passed"))

    def test_open_pr_fails_even_with_a_checklist(self):
        write_state(self.checkout, 7, DONE)
        self.fake.add_pr(REPO, 50, body="Closes #20", state="OPEN")
        self.assertFalse(self.get()[1]["gatePassed"])

    def test_merged_and_closed_pass(self):
        self.fake.add_pr(REPO, 50, body="Closes #20", state="MERGED")
        self.fake.add_pr(REPO, 51, head="kipo/7-extra", state="CLOSED")
        d = self.get()[1]
        self.assertTrue(d["gatePassed"])
        status, d = self.post("/advance")
        self.assertEqual((status, d["column"]), (200, "done"))


class PrMatchingTests(Columns):
    def test_matching(self):
        self.make_effort(column="build")
        self.ticket(20)
        self.ticket(21, state="CLOSED")
        self.fake.add_issue(REPO, 30, labels=["kipo:8"])  # another effort's ticket
        self.fake.add_pr(REPO, 40, body="Fixes #20 and resolves acme/widgets#21", state="MERGED")
        self.fake.add_pr(REPO, 41, head="kipo/7", draft=True)
        self.fake.add_pr(REPO, 42, body="Closes #7")
        self.fake.add_pr(REPO, 43, body="Closes #30", head="kipo/8")  # the other effort
        self.fake.add_pr(REPO, 44, head="kipo/70")
        self.fake.add_pr(REPO, 45, body="Mentions #20 without closing it")
        self.fake.add_pr(REPO, 46, body="Closes other/repo#20")
        d = self.get()[1]
        self.assertEqual([p["number"] for p in d["prs"]], [40, 41, 42])
        by = {p["number"]: p for p in d["prs"]}
        self.assertEqual(by[40]["tickets"], [20, 21])
        self.assertEqual((by[40]["state"], by[41]["isDraft"], by[41]["headRefName"]), ("MERGED", True, "kipo/7"))
        self.assertNotIn("body", by[40])
        tickets = {t["number"]: t for t in d["tickets"]}
        self.assertEqual((tickets[20]["prs"], tickets[21]["prs"]), ([40], [40]))
        self.assertEqual(d["ticketCounts"], {"open": 1, "closed": 1})
        pr_lists = [c for c in self.fake.calls if c[1:3] == ["pr", "list"]]
        self.assertEqual(len(pr_lists), 1)
        self.assertIn("--state", pr_lists[0])
        self.assertEqual(pr_lists[0][pr_lists[0].index("--limit") + 1], "100")


class ListTests(Columns):
    def test_ticket_counts(self):
        self.make_effort(7, column="build")
        self.make_effort(8, column="grill")
        self.ticket(20, n=7)
        self.ticket(21, n=7, state="CLOSED")
        self.ticket(22, n=7, state="CLOSED")
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200, out)
        by = {i["number"]: i for i in out["initiatives"]}
        self.assertEqual(by[7]["ticketCounts"], {"open": 1, "closed": 2})
        self.assertIsNone(by[8]["ticketCounts"])
        self.assertEqual((by[7]["column"], by[7]["start"]), ("build", "idea"))
        self.assertEqual(self.fake.issue_queries, 1)


class SessionTests(Columns):
    def report(self, source, n=7):
        return (f"Report: python3 {ini.KIPO_CLI} report {REPO} {n} --from {source} --checkout {self.checkout} "
                '--event <kind> --text "<one line>" [--item "<one per question, PR or issue>"]...')

    def seed(self, column, conversation, stage, extra=(), run=None, n=7, state=None, source=None):
        lines = [
            f'[KiPo] Effort #{n} "Widgets" in {REPO}',
            f"Conversation: {conversation}",
            f"Stage: {stage}",
            "Start: idea",
            f"Repo checkout: {self.checkout}",
            f"Effort issue: https://github.com/{REPO}/issues/{n}",
            f"State file: {self.checkout}/.kipo/{n}/{state or (source or column) + '.json'}",
            f"Matt's skills: {SKILLS_DIR}",
            self.report(source or column, n),
            *extra,
            f"Load the skill `kipo-{column}` and follow it. Destination: Ship widgets.",
        ]
        if run:
            lines.append(RUN.format(s=run))
        return "\n".join(lines)

    def test_column_seed_with_skill(self):
        self.make_effort()
        path = PATHS["idea"]
        status, out = self.post("/session", {"column": "grill", "skill": "grill-with-docs"})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], f"kipo-acme-widgets-7-grill")
        self.assertFalse(out["existing"])
        self.assertEqual(out["seed"], self.seed("grill", "the effort's own conversation", "Decide", run="grill-with-docs"))
        status, out = self.post("/session", {"column": "grill"})
        self.assertEqual(out["seed"], self.seed("grill", "the effort's own conversation", "Decide"))

    def test_grill_and_plan_share_a_session(self):
        self.make_effort(column="plan")
        self.post("/session", {"column": "grill"})
        status, out = self.post("/session", {"column": "plan", "skill": "to-spec"})
        self.assertEqual(status, 200, out)
        self.assertTrue(out["existing"])
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-grill")
        self.assertEqual(
            out["seed"],
            "The hand-over: write the spec, then the tickets, from what this conversation decided. "
            "Load the skill `kipo-plan` and follow it. From now on keep the hand-over's own state file "
            "and report as the hand-over:\n"
            f"State file: {self.checkout}/.kipo/7/plan.json\n"
            + self.report("plan") + "\n" + RUN.format(s="to-spec"),
        )
        self.assertEqual(self.get()[1]["sessions"], {"grill": "kipo-acme-widgets-7-grill", "plan": "kipo-acme-widgets-7-grill"})

    def test_plan_without_grill_gets_its_own(self):
        self.make_effort(start="huge", column="plan")
        status, out = self.post("/session", {"column": "plan"})
        self.assertEqual(status, 200, out)
        self.assertFalse(out["existing"])
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-plan")
        self.assertIn("Conversation: the hand-over: the spec, then the tickets", out["seed"])
        self.assertNotIn("Column:", out["seed"])
        self.assertIn("Start: huge", out["seed"])

    def test_build_ticket_session(self):
        self.make_effort(column="build")
        self.ticket(19, state="CLOSED")
        self.ticket(20, title="Add export")
        self.fake.blocked_by[(REPO, 20)] = [19]
        status, out = self.post("/session", {"column": "build", "ticket": 20})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-build-t20")
        self.assertEqual(out["seed"], self.seed(
            "build", "ticket #20, in the Deliver lane", "Deliver", extra=['Ticket: #20 "Add export"', "Blocked by: #19 (closed)"], run="implement",
            state="build-t20.json", source="build-t20",
        ))
        d = self.get()[1]
        self.assertEqual(d["sessions"]["build-t20"], "kipo-acme-widgets-7-build-t20")
        self.assertEqual({t["number"]: t["sessionKey"] for t in d["tickets"]}, {19: None, 20: "build-t20"})

    def test_detail_carries_the_close_rule_and_records_closed_sessions(self):
        # A finished build whose ticket closed is closable; the page closes it
        # and records it; the conductor stays; an unknown key is refused.
        from kipo import reports
        self.make_effort(column="build")
        self.ticket(20, title="Add export")
        self.post("/session", {"column": "build", "ticket": 20})
        self.post("/session", {"column": "build", "mode": "conductor"})
        reports.append(self.checkout, 7, "build-t20", "finished", "Built #20; PR #50 open.")
        rows = {r["key"]: r["status"] for r in self.get()[1]["closing"]}
        self.assertEqual(rows, {"build-t20": "open", "conductor": "open"})  # #20 is still open
        self.fake.issues[(REPO, 20)]["state"] = "CLOSED"
        self.app.initiatives._gh_cache.clear()  # the change is GitHub's own: as if the TTL expired
        rows = {r["key"]: r["status"] for r in self.get()[1]["closing"]}
        self.assertEqual(rows, {"build-t20": "closable", "conductor": "open"})
        status, out = self.post("/sessions/closed", {"keys": ["build-t20"]})
        self.assertEqual(status, 200, out)
        rows = {r["key"]: r["status"] for r in self.get()[1]["closing"]}
        self.assertEqual(rows, {"build-t20": "closed", "conductor": "open"})
        self.assertEqual(self.post("/sessions/closed", {"keys": ["conductor"]})[0], 400)
        self.assertEqual(self.post("/sessions/closed", {"keys": ["build-t99"]})[0], 400)

    def test_detail_carries_stalls_from_posted_activity_and_records_wakes(self):
        # The page posts what Kiro Crew says of each session; an idle one with
        # an unfinished report is stalled; its wake is recorded once in the
        # checkout, and then it reads woken. The conductor is never woken.
        import datetime
        from kipo import reports
        ini_ = self.app.initiatives
        ini_.transcript_activity = lambda slots: {}
        self.make_effort(column="build")
        self.ticket(20, title="Add export")
        self.post("/session", {"column": "build", "ticket": 20})
        self.post("/session", {"column": "build", "mode": "conductor"})
        # Its report came before its last activity (a fresher one resets the idle clock).
        reports.append(self.checkout, 7, "build-t20", "started", "Building #20.", clock=lambda: "2026-11-10T11:59:00Z")
        status, out = self.post("/sessions/activity", {"activity": {
            "build-t20": {"at": "2026-11-10T12:00:00Z", "running": False, "agent": True},
            "nobody": {"at": "2026-11-10T12:00:00Z"}}})
        self.assertEqual((status, out), (200, {"recorded": ["build-t20"]}))
        seen = datetime.datetime.fromisoformat(self.storage.get_activity(REPO, 7)["build-t20"]["seen"].replace("Z", "+00:00"))
        # A minute after it was seen (still fresh), the session last moved at 12:00: long idle.
        ini_.now = lambda: seen + datetime.timedelta(minutes=1)
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "build-t20")
        self.assertEqual(row["stall"]["state"], "stalled")
        status, out = self.post("/sessions/woken", {"key": "build-t20", "stall": row["stall"]["id"], "why": row["stall"]["why"]})
        self.assertEqual(status, 200, out)
        self.assertTrue(os.path.exists(os.path.join(self.checkout, ".kipo", "7", "wakes.json")))
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "build-t20")
        self.assertEqual(row["stall"]["state"], "woken")
        self.assertEqual(self.post("/sessions/woken", {"key": "conductor", "stall": "x"})[0], 400)
        self.assertEqual(self.post("/sessions/woken", {"key": "build-t20"})[0], 400)

    def test_ticket_review_session_beside_its_build(self):
        # A dispatched --ticket 20 --skill kipo-review: its own review conversation,
        # seeded with the ticket and its open PR, not a second build session.
        self.make_effort(column="build")
        self.ticket(20, title="Add export")
        self.fake.add_pr(REPO, 50, body="Closes #20")
        self.fake.add_pr(REPO, 51, body="Closes #20", state="MERGED")
        self.post("/session", {"column": "build", "ticket": 20})
        status, out = self.post("/session", {"column": "review", "ticket": 20, "skill": "kipo-review"})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-review-t20")
        seed = out["seed"].split("\n")
        self.assertIn("Conversation: ticket #20's review: its PR reviewed, fixed and merged", seed)
        self.assertIn('Ticket: #20 "Add export"', seed)
        self.assertIn(f"PRs: #50 {self.fake.prs[(REPO, 50)]['url']}".strip(), seed)
        self.assertIn(f"State file: {self.checkout}/.kipo/7/review-t20.json", seed)
        self.assertIn(self.report("review-t20"), seed)
        self.assertIn("Load the skill `kipo-review` and follow it. Destination: Ship widgets.", seed)
        self.assertNotIn("Run /", out["seed"])  # kipo-review is the column's own skill, loaded above
        self.assertEqual({k: v for k, v in self.get()[1]["sessions"].items() if k.endswith("t20")},
                         {"build-t20": "kipo-acme-widgets-7-build-t20", "review-t20": "kipo-acme-widgets-7-review-t20"})

    def test_ticket_sessions_only_in_build_shape_and_review(self):
        self.make_effort(column="build")
        self.ticket(20)
        status, out = self.post("/session", {"column": "plan", "ticket": 20})
        self.assertEqual((status, out["code"]), (400, "invalid_ticket"))

    def test_ticket_without_blockers_has_no_blocked_line(self):
        self.make_effort(column="build")
        self.ticket(20)
        out = self.post("/session", {"column": "build", "ticket": 20})[1]
        self.assertNotIn("Blocked by", out["seed"])

    def test_blocked_ticket_is_refused(self):
        self.make_effort(column="build")
        self.ticket(19)
        self.ticket(20)
        self.fake.blocked_by[(REPO, 20)] = [19]
        status, out = self.post("/session", {"column": "build", "ticket": 20})
        self.assertEqual((status, out["code"], out["blockedBy"]), (409, "ticket_blocked", [19]))
        self.assertEqual(self.get()[1]["tickets"][1]["blockedBy"], [19])
        self.assertNotIn("build-t20", self.get()[1]["sessions"])

    def test_not_a_ticket(self):
        self.make_effort(column="build")
        self.fake.add_issue(REPO, 30, labels=["kipo:8"])
        status, out = self.post("/session", {"column": "build", "ticket": 30})
        self.assertEqual((status, out["code"]), (404, "not_ticket"))

    def test_implement_spec(self):
        self.make_effort(column="build")
        status, out = self.post("/session", {"column": "build", "mode": "implement-spec"})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-build-spec")
        self.assertTrue(out["seed"].endswith(RUN.format(s="implement-spec")))
        self.assertIn("build-spec", self.get()[1]["sessions"])
        status, out = self.post("/session", {"column": "grill", "mode": "implement-spec"})
        self.assertEqual((status, out["code"]), (400, "invalid_mode"))

    def test_conductor_session(self):
        self.make_effort(column="build")
        status, out = self.post("/session", {"column": "build", "mode": "conductor"})
        self.assertEqual(status, 200, out)
        self.assertEqual((out["slotName"], out["agent"]), ("kipo-acme-widgets-7-conductor", "kipo-conductor"))
        self.assertIn("Load the skill `kipo-conductor`", out["seed"])
        self.assertIn("kipo_cli.py frontier acme/widgets 7", out["seed"])
        self.assertIn("conductor.json", out["seed"])
        self.assertIn("kipo_cli.py reports acme/widgets 7 --checkout", out["seed"])
        self.assertIn("conductor", self.get()[1]["sessions"])

    def test_shape_decision_ticket(self):
        self.make_effort(start="huge")
        self.fake.add_issue(REPO, 31, title="Pick auth", labels=["wayfinder:decision"])
        status, out = self.post("/session", {"column": "shape", "ticket": 31})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-shape-t31")
        self.assertIn('Ticket: #31 "Pick auth"\nLoad the skill `kipo-shape`', out["seed"])
        self.assertIn(self.report("shape-t31"), out["seed"])

    def test_bad_input(self):
        self.make_effort()
        for body, code in (
            ({"column": "delivery"}, "invalid_column"),
            ({"column": "grill", "skill": "deploy"}, "unknown_skill"),
            ({"column": "grill", "ticket": 4}, "invalid_ticket"),
            ({"column": "build", "ticket": "x"}, "invalid_ticket"),
        ):
            status, out = self.post("/session", body)
            self.assertEqual((status, out["code"]), (400, code), body)


class SkillTests(Columns):
    def test_run_line_and_unknown(self):
        status, out = self.post("/skill", {"skill": "to-tickets"})
        self.assertEqual((status, out), (200, {"message": RUN.format(s="to-tickets")}))
        for bad in ("deploy", "", None):
            status, out = self.post("/skill", {"skill": bad})
            self.assertEqual((status, out["code"]), (400, "unknown_skill"), bad)


class DocTests(Columns):
    def setUp(self):
        super().setUp()
        self.make_effort(column="plan")

    def doc(self, href):
        from urllib.parse import quote
        return self.app.dispatch("GET", f"/initiatives/{REPO}/7/doc?href={quote(href, safe='')}", "")

    def test_path_inside(self):
        os.makedirs(os.path.join(self.checkout, "docs"))
        with open(os.path.join(self.checkout, "docs", "spec.md"), "w") as f:
            f.write("intro\n# Widget spec\n\nBody.\n")
        for href in ("docs/spec.md", os.path.join(self.checkout, "docs", "spec.md")):
            status, out = self.doc(href)
            self.assertEqual(status, 200, out)
            self.assertEqual(out, {
                "href": href, "title": "Widget spec", "kind": "markdown",
                "text": "intro\n# Widget spec\n\nBody.\n", "url": None,
            })

    def test_path_outside(self):
        with open(os.path.join(self.tmp, "secret.md"), "w") as f:
            f.write("no")
        os.symlink(os.path.join(self.tmp, "secret.md"), os.path.join(self.checkout, "link.md"))
        for href in ("../secret.md", os.path.join(self.tmp, "secret.md"), "link.md", "/etc/hosts"):
            status, out = self.doc(href)
            self.assertEqual((status, out["code"]), (400, "outside_checkout"), href)

    def test_blob_on_a_branch_with_slashes(self):
        self.fake.blobs["origin/research/stock:docs/research/stock.md"] = "# Stock rules\n\nNotes.\n"
        href = f"https://github.com/{REPO}/blob/research/stock/docs/research/stock.md"
        status, out = self.doc(href)
        self.assertEqual(status, 200, out)
        self.assertEqual((out["title"], out["url"]), ("Stock rules", href))
        status, out = self.doc("https://github.com/other/repo/blob/main/x.md")
        self.assertEqual((status, out["code"]), (400, "unsupported_href"))

    def test_missing(self):
        status, out = self.doc("docs/nope.md")
        self.assertEqual((status, out["code"]), (404, "doc_missing"))

    def test_cap(self):
        with open(os.path.join(self.checkout, "big.md"), "w") as f:
            f.write("x" * (300 * 1024))
        status, out = self.doc("big.md")
        self.assertEqual(status, 200)
        self.assertLess(len(out["text"].encode()), 201 * 1024)
        self.assertIn("cut at 200 KB", out["text"])

    def test_issue_url(self):
        self.fake.add_issue(REPO, 12, title="Spec issue", body="The spec.")
        status, out = self.doc(f"https://github.com/{REPO}/issues/12")
        self.assertEqual(status, 200, out)
        self.assertEqual((out["title"], out["text"], out["url"]), ("Spec issue", "The spec.", f"https://github.com/{REPO}/issues/12"))

    def test_pr_url(self):
        self.fake.add_pr(REPO, 5, title="Add export", body="PR body")
        status, out = self.doc(f"https://github.com/{REPO}/pull/5")
        self.assertEqual((status, out["title"], out["text"]), (200, "Add export", "PR body"))

    def test_other_repo_or_site(self):
        for href in ("https://github.com/other/repo/issues/1", "https://example.com/x"):
            status, out = self.doc(href)
            self.assertEqual((status, out["code"]), (400, "unsupported_href"), href)

    def test_map_lists_sub_issues(self):
        self.fake.add_issue(REPO, 9, title="Wayfinder map", body="The map.", labels=["wayfinder:map"])
        self.fake.add_issue(REPO, 10, title="Pick auth", labels=["wayfinder:decision"], state="CLOSED")
        self.fake.add_issue(REPO, 11, title="Spike storage", labels=["wayfinder:task"])
        self.fake.add_issue(REPO, 12, title="Untyped")
        self.fake.sub_issues[(REPO, 9)] = [10, 11, 12]
        status, out = self.doc(f"https://github.com/{REPO}/issues/9")
        self.assertEqual(status, 200, out)
        self.assertEqual(out["text"], "\n".join([
            "The map.", "", "## Tickets", "",
            "- ☑ #10 Pick auth (decision)",
            "- ☐ #11 Spike storage (task)",
            "- ☐ #12 Untyped",
        ]))

    def test_href_required(self):
        status, out = self.get("/doc")
        self.assertEqual((status, out["code"]), (400, "invalid_request"))


if __name__ == "__main__":
    unittest.main()


class SourceIssuePrTests(Columns):
    """An effort started from an issue: the PR that closes that issue is the effort's PR."""

    def test_pr_closing_the_source_issue_link_counts(self):
        self.make_effort(start="issue", column="review", artifacts=[
            {"label": "Source issue", "href": f"https://github.com/{REPO}/issues/22"},
        ])
        self.fake.add_pr(REPO, 33, body="Closes #22.", state="OPEN")
        d = self.get()[1]
        self.assertEqual([p["number"] for p in d["prs"]], [33])
        self.assertFalse(d["gatePassed"])

    def test_pr_closing_the_meta_source_issue_counts(self):
        self.make_effort(start="issue", column="review", meta={"sourceIssue": 22})
        self.fake.add_pr(REPO, 33, body="Fixes #22", state="MERGED")
        self.assertTrue(self.get()[1]["gatePassed"])

    def test_source_issue_in_another_repo_is_ignored(self):
        self.make_effort(start="issue", column="review", artifacts=[
            {"label": "Source issue", "href": "https://github.com/other/repo/issues/22"},
        ])
        self.fake.add_pr(REPO, 33, body="Closes #22.", state="OPEN")
        self.assertEqual(self.get()[1]["prs"], [])


class FrontierDetailTests(Columns):
    """The detail's frontier puts build tickets and map children in their real states."""

    def setUp(self):
        super().setUp()
        self.make_effort(column="build", meta={"mapIssue": 20})
        self.fake.add_issue(REPO, 20, title="Map", body="## Not yet specified\n- offline\n- transfer\n", labels=["wayfinder:map"])
        self.fake.add_issue(REPO, 24, title="Deleted license?", labels=["wayfinder:grilling"])
        self.fake.add_issue(REPO, 30, title="Stripe entitlements", labels=["wayfinder:research"])
        self.fake.add_issue(REPO, 21, title="Old grill", labels=["wayfinder:grilling"], state="CLOSED")
        self.fake.sub_issues[(REPO, 20)] = [21, 24, 30]
        self.ticket(28)
        self.ticket(29)
        self.ticket(35)
        self.fake.blocked_by[(REPO, 35)] = [24]
        self.fake.add_pr(REPO, 33, body="Closes #29", state="OPEN")

    def test_states_counts_and_fog(self):
        f = self.get()[1]["frontier"]
        states = {t["number"]: (t["code"], t["state"]) for t in f["tiles"]}
        self.assertEqual(states, {
            21: ("Gr", "done"), 24: ("Gr", "you"), 30: ("Rs", "afk"),
            28: ("Bd", "afk"), 29: ("Bd", "review"), 35: ("Bd", "blocked"),
        })
        self.assertEqual(f["counts"], {"done": 1, "review": 1, "building": 0, "you": 1, "afk": 2, "blocked": 1})
        self.assertEqual(f["fog"], 2)

    def test_the_list_carries_the_last_frontier_seen(self):
        self.get()
        listed = self.app.dispatch("GET", "/initiatives", "")[1]["initiatives"]
        self.assertEqual(listed[0]["frontier"]["counts"]["afk"], 2)
        self.assertEqual(listed[0]["frontier"]["fog"], 2)


class ClosedMapTests(Columns):
    def test_a_closed_maps_fog_doesnt_hold_the_effort_in_decide(self):
        self.make_effort(column="build", meta={"mapIssue": 20})
        self.fake.add_issue(REPO, 20, title="Map", body="## Not yet specified\n- later\n- maybe\n", labels=["wayfinder:map"], state="CLOSED")
        self.fake.add_issue(REPO, 24, title="Done grill", labels=["wayfinder:grilling"], state="CLOSED")
        self.fake.sub_issues[(REPO, 20)] = [24]
        f = self.get()[1]["frontier"]
        self.assertEqual((f["fog"], f["fogLeft"], f["active"]["decide"]), (0, ["later", "maybe"], False))


class MapArtifactLabelTests(Columns):
    def test_a_numbered_map_label_names_the_map(self):
        self.make_effort(column="build", artifacts=[{"label": "Wayfinder map #20", "href": f"https://github.com/{REPO}/issues/20"}])
        self.assertEqual(self.get()[1]["mapIssue"], 20)


class TwoLaneDetailTests(Columns):
    def test_stage_and_lanes_in_the_detail_and_list(self):
        self.make_effort(column="build", meta={"mapIssue": 20})
        self.fake.add_issue(REPO, 20, title="Map", labels=["wayfinder:map"])
        self.fake.add_issue(REPO, 24, title="Grill", labels=["wayfinder:grilling"])
        self.fake.add_issue(REPO, 22, title="Code", labels=["wayfinder:task", "ready-for-agent"])
        self.fake.sub_issues[(REPO, 20)] = [22, 24]
        f = self.get()[1]["frontier"]
        self.assertEqual((f["stage"], f["active"]), ("decide", {"decide": True, "deliver": True}))
        self.assertEqual(f["lanes"]["deliver"]["afk"], 1)
        listed = self.app.dispatch("GET", "/initiatives", "")[1]["initiatives"][0]
        self.assertEqual(listed["stage"], "decide")

    def test_a_map_child_can_be_built(self):
        self.make_effort(column="build", meta={"mapIssue": 20})
        self.fake.add_issue(REPO, 20, title="Map", labels=["wayfinder:map"])
        self.fake.add_issue(REPO, 22, title="Code", labels=["wayfinder:task", "ready-for-agent"])
        self.fake.sub_issues[(REPO, 20)] = [22]
        status, out = self.post("/session", {"column": "build", "ticket": 22, "skill": "implement"})
        self.assertEqual(status, 200, out)
        self.assertIn("build-t22", self.get()[1]["sessions"])

    def test_the_source_issue_is_a_tile_and_can_be_built(self):
        self.make_effort(start="issue", column="build", meta={"sourceIssue": 22})
        self.fake.add_issue(REPO, 22, title="Bug", labels=["ready-for-agent"])
        tiles = self.get()[1]["frontier"]["tiles"]
        self.assertEqual([(t["number"], t["lane"], t["source"]) for t in tiles], [(22, "deliver", True)])
        status, out = self.post("/session", {"column": "build", "ticket": 22})
        self.assertEqual(status, 200, out)


class TicketCardTests(Columns):
    def test_body_and_latest_comment(self):
        self.make_effort()
        self.fake.add_issue(REPO, 23, title="Spend from own product", body="Make it so.", state="CLOSED")
        self.fake.issues[(REPO, 23)]["comments"] = [
            {"author": {"login": "a"}, "body": "first", "createdAt": "2026-11-07T00:00:00Z"},
            {"author": {"login": "bot"}, "body": "Resolved: done in #36.", "createdAt": "2026-11-08T00:00:00Z"},
        ]
        status, card = self.get("/tickets/23")
        self.assertEqual(status, 200, card)
        self.assertEqual((card["state"], card["body"], card["comments"]), ("CLOSED", "Make it so.", 2))
        self.assertEqual(card["lastComment"]["body"], "Resolved: done in #36.")


class SessionStateTests(Columns):
    """Each ticket conversation has its own state file, read back per session."""

    def test_ticket_state_is_its_own_and_read_back(self):
        self.make_effort(column="build")
        self.ticket(20, title="Add export")
        out = self.post("/session", {"column": "build", "ticket": 20})[1]
        path = f"{self.checkout}/.kipo/7/build-t20.json"
        self.assertIn(f"State file: {path}", out["seed"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump({"skillsUsed": ["implement", "tdd"], "decisions": [], "gate": [],
                       "artifacts": [{"label": "Notes", "href": "docs/notes.md"}]}, f)
        d = self.get()[1]
        self.assertEqual(d["sessionStates"]["build-t20"]["skillsUsed"], ["implement", "tdd"])
        self.assertIn("docs/notes.md", [a["href"] for a in d["artifacts"]])
        # A stage conversation has its own file too, named by its key.
        main = self.post("/session", {"column": "build"})[1]
        self.assertIn(f"State file: {self.checkout}/.kipo/7/build.json", main["seed"])

    def test_stage_state_is_its_own_and_read_back(self):
        self.make_effort(column="review")
        out = self.post("/session", {"column": "review"})[1]
        path = f"{self.checkout}/.kipo/7/review.json"
        self.assertIn(f"State file: {path}", out["seed"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump({"skillsUsed": ["kipo-review"], "decisions": [{"id": "merge", "title": "Merge?", "options": ["Yes"], "answer": None}],
                       "artifacts": [{"label": "Notes", "href": "docs/review.md"}]}, f)
        d = self.get()[1]
        self.assertEqual([x["id"] for x in d["sessionStates"]["review"]["decisions"]], ["merge"])
        self.assertIn("docs/review.md", [a["href"] for a in d["artifacts"]])
        row = next(r for r in d["closing"] if r["key"] == "review")
        self.assertEqual(row["reason"], "1 unanswered decision card")


class TicketDecisionsInTheEffortFileTests(Columns):
    """Ticket conversations seeded before each had its own file wrote their
    decisions into the effort's state.json; they show under their ticket."""

    def test_a_tickets_decisions_move_to_its_conversation(self):
        self.make_effort(column="build")
        self.storage.record_session(REPO, 7, "shape-t30", "slot-t30")
        write_state(self.checkout, 7, {"decisions": [
            {"id": "t30-qsight", "title": "qSIGHT licenses", "options": ["None", "All"], "answer": None},
            {"id": "t30-bm", "title": "Blue Mantis", "options": ["Keep"], "answer": "Keep"},
            {"id": "migration-013", "title": "Migration 013", "options": ["Run"], "answer": None},
            {"id": "t99-orphan", "title": "No session for #99", "options": ["A"], "answer": None},
        ], "gate": [], "artifacts": []})
        d = self.get()[1]
        self.assertEqual([x["id"] for x in d["state"]["decisions"]], ["migration-013", "t99-orphan"])
        self.assertEqual([x["id"] for x in d["sessionStates"]["shape-t30"]["decisions"]], ["t30-qsight", "t30-bm"])

    def test_the_tickets_own_file_keeps_its_decisions_first(self):
        self.make_effort(column="build")
        self.storage.record_session(REPO, 7, "shape-t30", "slot-t30")
        write_state(self.checkout, 7, {"decisions": [{"id": "t30-a", "title": "A", "options": [], "answer": None}]})
        path = f"{self.checkout}/.kipo/7/shape-t30.json"
        with open(path, "w") as f:
            json.dump({"decisions": [{"id": "own", "title": "Own", "options": [], "answer": None}], "skillsUsed": ["grilling"]}, f)
        s = self.get()[1]["sessionStates"]["shape-t30"]
        self.assertEqual([x["id"] for x in s["decisions"]], ["own", "t30-a"])
        self.assertEqual(s["skillsUsed"], ["grilling"])


class StageDecisionsInTheEffortFileTests(Columns):
    """Stage conversations seeded before each had its own file share state.json
    (effort #1054: the grill, the hand-over in the grill's conversation, and
    the review). Each card shows under the session that asked it."""

    def test_a_card_is_attributed_to_the_session_that_asked_it(self):
        self.make_effort(column="plan")
        for key, slot in (("grill", "slot-g"), ("plan", "slot-g"), ("review", "slot-r")):
            self.storage.record_session(REPO, 7, key, slot)
        write_state(self.checkout, 7, {"blocking": "the seams", "decisions": [
            {"id": "audience", "title": "Who?", "options": ["A"], "answer": "A"},
            {"id": "seams", "title": "Two seams?", "options": ["Yes"], "answer": None},
        ], "gate": [], "artifacts": []})
        for source, event, items in (("grill", "asked", ["audience: Who?"]), ("grill", "finished", []),
                                     ("plan", "started", []), ("plan", "asked", ["seams: Two seams?"])):
            col_reports.append(self.checkout, 7, source, event, "x", items)
        with open(st.state_path(self.checkout, 7)) as f:
            before = f.read()
        d = self.get()[1]
        self.assertEqual([x["id"] for x in d["sessionStates"]["plan"]["decisions"]], ["seams"])
        self.assertEqual([x["id"] for x in d["sessionStates"]["grill"]["decisions"]], ["audience"])
        self.assertNotIn("review", d["sessionStates"])
        rows = {r["key"]: r for r in d["closing"]}
        self.assertEqual(rows["plan"]["reason"], "1 unanswered decision card")
        self.assertNotIn("decision card", rows["review"]["reason"])
        self.assertNotIn("decision card", rows["grill"]["reason"])
        with open(st.state_path(self.checkout, 7)) as f:
            self.assertEqual(f.read(), before)  # read-time only


class MapAsEffortTests(Columns):
    """A wayfinder map you open in KiPo is an effort in its own right."""

    MAP_BODY = "## Destination\n\nA spec for the thing.\n\n## Notes\n\nn\n\n## Not yet specified\n\n- later\n"

    def add_map(self, number=50, title="Map: the thing"):
        self.fake.add_issue(REPO, number, title=title, body=self.MAP_BODY, labels=["wayfinder:map"])
        self.fake.add_issue(REPO, 51, title="Which way?", labels=["wayfinder:grilling"])
        self.fake.add_issue(REPO, 52, title="Look it up", labels=["wayfinder:research"])
        self.fake.blocked_by[(REPO, 52)] = [51]
        self.fake.sub_issues[(REPO, number)] = [51, 52]
        return number

    def open_map(self, number=50):
        status, out = self.app.dispatch("POST", "/sidebar", json.dumps({"repo": REPO, "number": number, "kind": "map", "on": True}))
        self.assertEqual(status, 200, out)
        return out

    def listed(self):
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200, out)
        return {i["number"]: i for i in out["initiatives"]}

    def test_an_added_repos_maps_are_listed_without_opening_them(self):
        self.add_map()
        m = self.listed()[50]
        self.assertEqual((m["kind"], m["column"], m["destination"]), ("map", "shape", "A spec for the thing."))

    def test_a_map_an_effort_already_wraps_is_not_listed_twice(self):
        self.make_effort(column="shape", meta={"mapIssue": 50})
        self.add_map()
        self.open_map()
        self.assertEqual(sorted(self.listed()), [7])

    def test_a_maps_detail_reads_its_own_children(self):
        self.add_map()
        status, d = self.get(n=50)
        self.assertEqual(status, 200, d)
        self.assertEqual(d["mapIssue"], 50)
        states = {t["number"]: t["state"] for t in d["frontier"]["tiles"]}
        self.assertEqual(states, {51: "you", 52: "blocked"})
        self.assertEqual(d["frontier"]["fog"], 1)

    def test_hiding_a_map_closes_it_in_kipo_not_on_github(self):
        self.add_map()
        self.open_map()
        status, out = self.post("/hide", n=50)
        self.assertEqual(status, 200, out)
        self.assertEqual(self.fake.issues[(REPO, 50)]["state"], "OPEN")
        self.assertNotIn(50, self.listed())

    def test_hiding_an_effort_takes_it_off_the_sidebar_until_restored(self):
        self.make_effort(column="build")
        self.post("/hide")
        self.assertNotIn(7, self.listed())
        self.assertEqual(self.fake.issues[(REPO, 7)]["state"], "OPEN")
        tree = self.app.dispatch("GET", "/tree", "")[1]["repos"][0]["items"]
        self.assertEqual([(i["number"], i["onSidebar"]) for i in tree if i["kind"] == "effort"], [(7, False)])
        self.post("/unhide")
        self.assertIn(7, self.listed())

    def test_a_map_child_gets_a_shape_session(self):
        self.add_map()
        status, out = self.post("/session", {"ticket": 51}, n=50)
        self.assertEqual(status, 200, out)
        self.assertIn("shape-t51", self.get(n=50)[1]["sessions"])

    def test_a_map_is_not_moved_by_kipo(self):
        self.add_map()
        status, out = self.post("/advance", {"force": True}, n=50)
        self.assertEqual(status, 409, out)
        self.assertEqual(out["code"], "map_not_moved")

    def test_an_issue_that_is_neither_is_refused(self):
        self.fake.add_issue(REPO, 60, title="Plain")
        self.assertEqual(self.get(n=60)[0], 404)


class PrsNamingATicketTests(Columns):
    """A PR that names an effort ticket (#n in its title or body) without a
    closing keyword: not one of the effort's ``prs`` (they close a ticket), but
    an open one is in ``refPrs`` with the tickets it names (#201's #609/#611/#612)."""

    def setUp(self):
        super().setUp()
        self.make_effort(column="build", meta={"mapIssue": 9})
        self.fake.add_issue(REPO, 9, title="Map", body="The map.", labels=["wayfinder:map"])
        self.fake.add_issue(REPO, 24, title="An ADR", labels=["wayfinder:grilling"], state="CLOSED")
        self.fake.sub_issues[(REPO, 9)] = [24]
        self.ticket(20, title="Add export")

    def test_open_prs_naming_a_ticket_or_map_child(self):
        self.fake.add_pr(REPO, 45, body="Mentions #20 without closing it")
        self.fake.add_pr(REPO, 609, title="docs: ADR 0007 (#24)", body="Docs only.")
        self.fake.add_pr(REPO, 610, title="docs: ADR 0008 (#24)", state="MERGED")
        self.fake.add_pr(REPO, 46, body="See other/repo#20")
        self.fake.add_pr(REPO, 47, body="Unrelated, see #3")
        self.fake.add_pr(REPO, 50, body="Closes #20")
        d = self.get()[1]
        self.assertEqual([p["number"] for p in d["prs"]], [50])
        self.assertEqual([(p["number"], p["refs"], p["state"]) for p in d["refPrs"]], [(45, [20], "OPEN"), (609, [24], "OPEN")])
        self.assertNotIn("body", d["refPrs"][0])
        # The tile states are as before: only a closing PR puts a ticket in review.
        self.assertEqual({t["number"]: t["state"] for t in d["frontier"]["tiles"]}[24], "done")

    def test_a_closed_tickets_review_is_seeded_with_the_prs_naming_it(self):
        self.fake.add_pr(REPO, 609, title="docs: ADR 0007 (#24)")
        status, out = self.post("/session", {"column": "review", "ticket": 24, "skill": "kipo-review"})
        self.assertEqual(status, 200, out)
        self.assertIn(f"PRs: #609 {self.fake.prs[(REPO, 609)]['url']}", out["seed"].split("\n"))


class SessionStartTests(Columns):
    """KiPo records when it opened each session and whether its seed went out,
    so a never-reported session is a stall candidate, an unstarted one is
    started again, and a re-dispatched thread gets a fresh slot."""

    def setUp(self):
        super().setUp()
        self.make_effort(column="build")
        self.ticket(20, title="Add export")
        self.app.initiatives.transcript_activity = lambda slots: {}

    def test_start_is_recorded_unseeded_then_seeded(self):
        status, out = self.post("/session", {"column": "review", "ticket": 20})
        self.assertEqual((status, out["key"]), (200, "review-t20"))
        start = self.get()[1]["starts"]["review-t20"]
        self.assertEqual((start["slot"], start["seeded"]), ("kipo-acme-widgets-7-review-t20", False))
        status, out = self.post("/sessions/started", {"key": "review-t20"})
        self.assertEqual(status, 200, out)
        self.assertTrue(self.get()[1]["starts"]["review-t20"]["seeded"])
        self.assertEqual(self.post("/sessions/started", {"key": "nope"})[0], 400)

    def test_an_unseeded_session_is_not_started_after_a_grace(self):
        import datetime
        self.post("/session", {"column": "review", "ticket": 20})
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "review-t20")
        self.assertNotIn("started", row)  # its seed may still be on its way
        self.app.initiatives.now = lambda: datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "review-t20")
        self.assertEqual(row["started"], False)

    def test_a_slot_missing_from_kiro_crew_is_not_started(self):
        self.storage.record_session(REPO, 7, "plan", "kipo-acme-widgets-7-plan")
        os.remove(os.path.join(self.storage.data_dir, "starts.json"))  # an older record: no start
        self.app.initiatives.known_slots = lambda: {"something-else"}
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "plan")
        self.assertEqual(row["started"], False)
        self.app.initiatives.known_slots = lambda: None  # session map unreadable: assume it exists
        self.assertNotIn("started", next(r for r in self.get()[1]["closing"] if r["key"] == "plan"))

    def test_replace_opens_a_fresh_slot(self):
        self.post("/session", {"column": "review", "ticket": 20})
        status, out = self.post("/session", {"column": "review", "ticket": 20, "replace": True})
        self.assertEqual((status, out["slotName"], out["existing"]), (200, "kipo-acme-widgets-7-review-t20-r2", False))
        d = self.get()[1]
        self.assertEqual(d["sessions"]["review-t20"], "kipo-acme-widgets-7-review-t20-r2")
        self.assertEqual(d["starts"]["review-t20"]["replaced"], ["kipo-acme-widgets-7-review-t20"])
        out = self.post("/session", {"column": "review", "ticket": 20, "replace": True})[1]
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-review-t20-r3")

    def test_starting_the_same_slot_again_keeps_its_start(self):
        self.post("/session", {"column": "review", "ticket": 20})
        first = self.get()[1]["starts"]["review-t20"]["at"]
        self.storage.record_session(REPO, 7, "review-t20", "kipo-acme-widgets-7-review-t20", when="2099-01-01T00:00:00Z")
        self.assertEqual(self.get()[1]["starts"]["review-t20"]["at"], first)

    def test_a_replacing_plan_is_a_new_conversation_not_the_handover(self):
        self.post("/session", {"column": "grill"})
        self.post("/session", {"column": "plan"})
        out = self.post("/session", {"column": "plan", "replace": True})[1]
        self.assertEqual((out["slotName"], out["existing"]), ("kipo-acme-widgets-7-plan-r2", False))


class SpecIssueTests(Columns):
    """#201: Plan filed spec #617 (label kipo:201) and cut it into #618-#633, its
    sub-issues. A spec is a parent, not work: no tile, no ticket, no build."""

    def setUp(self):
        super().setUp()
        self.make_effort(column="build")
        self.ticket(17, title="Spec: Held-store migration")
        self.ticket(18, title="Add the held table")
        self.ticket(19, title="Backfill", state="CLOSED")
        self.fake.sub_issues[(REPO, 17)] = [18, 19]

    def test_the_parent_of_effort_tickets_is_the_spec_not_a_tile(self):
        d = self.get()[1]
        self.assertEqual(sorted(t["number"] for t in d["frontier"]["tiles"]), [18, 19])
        self.assertEqual(sorted(t["number"] for t in d["tickets"]), [18, 19])
        self.assertEqual(d["ticketCounts"], {"open": 1, "closed": 1})
        self.assertEqual(sum(d["frontier"]["counts"].values()), 2)
        self.assertEqual(d["specIssues"], [17])

    def test_a_spec_artifact_names_it_too(self):
        # Without sub-issues, any "Spec" artifact (plan.json and state.json may each have one).
        self.fake.sub_issues.clear()
        os.makedirs(st.state_dir(self.checkout, 7), exist_ok=True)
        with open(st.session_state_path(self.checkout, 7, "plan"), "w") as f:
            json.dump({"artifacts": [{"label": "Spec", "href": f"https://github.com/{REPO}/issues/14"},
                                     {"label": "Spec", "href": f"https://github.com/{REPO}/issues/17"}]}, f)
        self.storage.record_session(REPO, 7, "plan", "kipo-acme-widgets-7-plan")
        d = self.get()[1]
        self.assertEqual(sorted(t["number"] for t in d["frontier"]["tiles"]), [18, 19])

    def test_no_build_session_for_the_spec(self):
        status, out = self.post("/session", {"column": "build", "ticket": 17})
        self.assertEqual((status, out["code"]), (409, "is_spec"))

    def test_its_existing_build_session_is_closable(self):
        from kipo import reports
        self.storage.record_session(REPO, 7, "build-t17", "kipo-acme-widgets-7-build-t17")
        reports.append(self.checkout, 7, "build-t17", "started", "Building #17")
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "build-t17")
        self.assertEqual(row["status"], "closable")
        self.assertIn("spec", row["reason"])

    def test_the_plans_issue_created_report_names_it_too(self):
        # #1054: no sub-issues read, no artifact; the plan reported creating it.
        self.fake.sub_issues.clear()
        col_reports.append(self.checkout, 7, "plan", "issue-created", "The spec for #7",
                           ["#17 Spec: Held-store migration"])
        col_reports.append(self.checkout, 7, "plan", "issue-created", "The 1 ticket of spec #17",
                           ["#18 Add the held table"])
        d = self.get()[1]
        self.assertEqual(d["specIssues"], [17])
        self.assertEqual(sorted(t["number"] for t in d["frontier"]["tiles"]), [18, 19])


class SeedAndStateWriteTests(Columns):
    """The detail carries what the stall rule needs beyond Kiro Crew's
    activity: each session's seed (from its transcript: when it opened, and
    whether it had a Report line) and its own state file's latest write."""

    def setUp(self):
        super().setUp()
        self.make_effort(column="build")
        self.ticket(20, title="Add export")
        self.app.initiatives.transcript_activity = lambda slots: {}
        self.storage.record_session(REPO, 7, "build-t20", "kipo-acme-widgets-7-build-t20")
        os.remove(os.path.join(self.storage.data_dir, "starts.json"))  # opened before KiPo kept starts

    def test_a_seed_with_a_report_line_makes_a_silent_session_stall(self):
        self.app.initiatives.transcript_seeds = lambda slots: {
            k: {"at": "2026-11-15T18:05:18Z", "reports": True} for k in slots}
        d = self.get()[1]
        self.assertEqual(d["seeds"]["build-t20"]["reports"], True)
        row = next(r for r in d["closing"] if r["key"] == "build-t20")
        self.assertEqual(row["stall"]["state"], "stalled")
        self.assertNotIn("started before reporting", row["reason"])

    def test_without_a_known_seed_it_is_left_alone(self):
        row = next(r for r in self.get()[1]["closing"] if r["key"] == "build-t20")
        self.assertNotIn("stall", row)
        self.assertIn("started before reporting", row["reason"])

    def test_state_writes_are_each_sessions_own_file(self):
        write_state(self.checkout, 7, {"summary": "x"})  # the shared state.json: no session's own
        os.makedirs(st.state_dir(self.checkout, 7), exist_ok=True)
        with open(st.session_state_path(self.checkout, 7, "build-t20"), "w") as f:
            json.dump({"summary": "building"}, f)
        os.utime(st.session_state_path(self.checkout, 7, "build-t20"), (1763229938, 1763229938))
        self.assertEqual(self.get()[1]["stateWrites"], {"build-t20": "2025-11-15T18:05:38Z"})
