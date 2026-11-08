"""Columns and paths, advance, the review gate, sessions, the skill endpoint, tickets and PRs, docs."""
import json
import os
import unittest

from test_backend import REPO, Base, write_state

from kipo import COLUMNS, PATHS, SKILLS, run_line
from kipo import initiatives as ini
from kipo import state as st

DONE = {"gate": [{"id": "g", "label": "Done", "done": True}]}
RUN = "Run /{s}: read /Users/masterphelps/.agents/skills/{s}/SKILL.md (and any file it links to) and follow it now, for this effort."


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
    def seed(self, column, conversation, stage, extra=(), run=None, n=7, state="state.json"):
        lines = [
            f'[KiPo] Effort #{n} "Widgets" in {REPO}',
            f"Conversation: {conversation}",
            f"Stage: {stage}",
            "Start: idea",
            f"Repo checkout: {self.checkout}",
            f"Effort issue: https://github.com/{REPO}/issues/{n}",
            f"State file: {self.checkout}/.kipo/{n}/{state}",
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
            "Load the skill `kipo-plan` and follow it.\n" + RUN.format(s="to-spec"),
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
            state="build-t20.json",
        ))
        d = self.get()[1]
        self.assertEqual(d["sessions"]["build-t20"], "kipo-acme-widgets-7-build-t20")
        self.assertEqual({t["number"]: t["sessionKey"] for t in d["tickets"]}, {19: None, 20: "build-t20"})

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

    def test_shape_decision_ticket(self):
        self.make_effort(start="huge")
        self.fake.add_issue(REPO, 31, title="Pick auth", labels=["wayfinder:decision"])
        status, out = self.post("/session", {"column": "shape", "ticket": 31})
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-shape-t31")
        self.assertIn('Ticket: #31 "Pick auth"\nLoad the skill `kipo-shape`', out["seed"])

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
        # The effort's own conversation still uses state.json.
        main = self.post("/session", {"column": "build"})[1]
        self.assertIn(f"State file: {self.checkout}/.kipo/7/state.json", main["seed"])


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

    def test_a_map_is_listed_only_once_you_open_it(self):
        self.add_map()
        self.assertNotIn(50, self.listed())
        self.open_map()
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
