"""v2: initiative phases with per-ticket stages, ship modes, the doc endpoint."""
import json
import os
import unittest

from test_backend import REPO, Base, write_state

from kipo import PHASES, STAGES
from kipo import initiatives as ini
from kipo import state as st

DONE = {"gate": [{"id": "g", "label": "Done", "done": True}]}


def write_ticket_state(repo_path, number, ticket, data):
    os.makedirs(st.ticket_dir(repo_path, number, ticket), exist_ok=True)
    with open(st.ticket_state_path(repo_path, number, ticket), "w") as f:
        json.dump(data, f)


class DeliveryBase(Base):
    def ticket(self, number, n=7, stage=None, state="OPEN", title=None, extra=()):
        labels = [f"kipo:{n}", *([f"stage:{stage}"] if stage else []), *extra]
        self.fake.add_issue(REPO, number, title=title or f"Ticket {number}", labels=labels, state=state)
        if stage:
            self.fake.labels.add((REPO, f"stage:{stage}"))
        return number

    def stage_of(self, number):
        return ini.stage_from_labels(sorted(self.fake.label_set(REPO, number)))

    def post(self, path, body="{}"):
        return self.app.dispatch("POST", f"/initiatives/{REPO}/7{path}", body)

    def get(self, path=""):
        return self.app.dispatch("GET", f"/initiatives/{REPO}/7{path}", "")


class PhaseMappingTests(DeliveryBase):
    def test_constants(self):
        self.assertEqual(PHASES, ("intake", "discovery", "refinement", "design", "delivery", "release", "operate"))
        self.assertEqual(STAGES, ("build", "review", "test", "security", "ready", "shipped"))

    def test_old_labels_read_as_delivery(self):
        for old in ("build", "review", "test", "security"):
            self.assertEqual(ini.phase_from_labels([f"phase:{old}"]), "delivery", old)
        self.assertEqual(ini.phase_from_labels(["phase:release"]), "release")
        self.assertEqual(ini.phase_from_labels(["phase:design", "phase:review"]), "delivery")

    def test_old_initiative_tickets_get_its_stage(self):
        self.make_initiative(phase="review")
        self.ticket(20)
        status, detail = self.get()
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "delivery")
        self.assertEqual(self.stage_of(20), "review")
        self.assertEqual(detail["tickets"][0]["stage"], "review")
        self.assertEqual(detail["tickets"][0]["sessionKey"], "t20-review")

    def test_old_initiative_advance_drops_old_label(self):
        self.make_initiative(phase="security")
        self.ticket(20, stage="ready")
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        labels = self.fake.label_set(REPO, 7)
        self.assertIn("phase:release", labels)
        self.assertNotIn("phase:security", labels)


class EnterDeliveryTests(DeliveryBase):
    def test_design_to_delivery_labels_tickets_and_copies_ship(self):
        self.make_initiative(phase="design")
        write_state(self.checkout, 7, {**DONE, "ship": "each"})
        self.ticket(20)
        self.ticket(21, stage="review")  # already staged: left alone
        self.ticket(22, state="CLOSED")  # closed: left alone
        self.fake.add_issue(REPO, 30, labels=["kipo:8"])  # another initiative's ticket
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "delivery")
        self.assertEqual(detail["ship"], "each")
        self.assertEqual(ini.parse_body(self.fake.issues[(REPO, 7)]["body"])["meta"]["ship"], "each")
        self.assertEqual(self.stage_of(20), "build")
        self.assertEqual(self.stage_of(21), "review")
        self.assertIsNone(self.stage_of(22))
        self.assertIsNone(self.stage_of(30))
        self.assertEqual([t["number"] for t in detail["tickets"]], [20, 21, 22])
        self.assertEqual(detail["delivery"]["total"], 2)
        self.assertEqual(detail["delivery"]["byStage"]["build"], 1)
        self.assertEqual(detail["delivery"]["byStage"]["review"], 1)
        self.assertFalse(detail["gatePassed"])

    def test_ship_defaults_to_together(self):
        self.make_initiative(phase="design")
        write_state(self.checkout, 7, DONE)
        self.ticket(20)
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["ship"], "together")

    def test_no_tickets_files_one(self):
        self.make_initiative(phase="design", labels=["size:small"])
        write_state(self.checkout, 7, DONE)
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        self.assertEqual(len(detail["tickets"]), 1)
        t = detail["tickets"][0]
        self.assertEqual((t["title"], t["stage"], t["sessionKey"]), ("Widgets", "build", f"t{t['number']}-build"))
        issue = self.fake.issues[(REPO, t["number"])]
        self.assertIn(f"https://github.com/{REPO}/issues/7", issue["body"])
        self.assertIn("## Destination\n\nShip widgets.", issue["body"])
        self.assertEqual(self.fake.label_set(REPO, t["number"]), {"kipo:7", "stage:build"})

    def test_ticket_filed_during_delivery_is_labelled_on_detail(self):
        self.make_initiative(phase="delivery", meta={"ship": "together"})
        self.ticket(20, stage="test")
        self.ticket(21)
        status, detail = self.get()
        self.assertEqual(status, 200, detail)
        self.assertEqual(self.stage_of(21), "build")
        self.assertEqual([t["stage"] for t in detail["tickets"]], ["test", "build"])

    def test_detail_before_delivery_does_not_label(self):
        self.make_initiative(phase="design")
        self.ticket(20)
        status, detail = self.get()
        self.assertEqual(status, 200, detail)
        self.assertIsNone(self.stage_of(20))
        self.assertIsNone(detail["tickets"][0]["stage"])
        self.assertIsNone(detail["tickets"][0]["sessionKey"])
        self.assertIsNone(detail["delivery"])


class TicketSessionTests(DeliveryBase):
    def setUp(self):
        super().setUp()
        self.make_initiative(phase="delivery", meta={"ship": "together"})

    def test_seed_and_record(self):
        self.ticket(20, stage="review", title="Add CSV export")
        status, out = self.post("/tickets/20/session")
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-7-t20-review")
        self.assertEqual(
            out["seed"],
            "\n".join([
                f'[KiPo] Initiative #7 "Widgets" in {REPO}',
                'Stage: review for ticket #20 "Add CSV export"',
                f"Repo checkout: {self.checkout}",
                f"Initiative issue: https://github.com/{REPO}/issues/7",
                f"Ticket issue: https://github.com/{REPO}/issues/20",
                f"State file: {self.checkout}/.kipo/7/t20/state.json",
                "Size: unset",
                "Ship: together",
                "Load the skill `phase-review` and follow it. Destination: Ship widgets.",
            ]),
        )
        self.assertEqual(self.get()[1]["sessions"], {"t20-review": "kipo-acme-widgets-7-t20-review"})

    def test_blocked(self):
        self.ticket(20, stage="build")
        self.ticket(21, stage="build")
        self.fake.add_issue(REPO, 40, title="Blocker")
        self.fake.add_issue(REPO, 41, title="Done blocker", state="CLOSED")
        self.fake.blocked_by[(REPO, 20)] = [40, 41]
        self.fake.blocked_by[(REPO, 21)] = [41]
        status, out = self.post("/tickets/20/session")
        self.assertEqual((status, out["code"], out["blockedBy"]), (409, "ticket_blocked", [40]))
        self.assertIn("#40", out["error"])
        self.assertEqual(self.post("/tickets/21/session")[0], 200)
        detail = self.get()[1]
        self.assertEqual({t["number"]: t["blockedBy"] for t in detail["tickets"]}, {20: [40], 21: []})

    def test_ready_or_shipped_blocker_no_longer_blocks(self):
        # Together mode keeps tickets open until Release; a ready blocker must not deadlock.
        self.ticket(20, stage="ready")
        self.ticket(21, stage="shipped")
        self.ticket(22, stage="security")
        self.ticket(23, stage="build", title="Dependent")
        self.fake.add_issue(REPO, 40, title="Outside, closed", state="CLOSED")
        self.fake.add_issue(REPO, 41, title="Outside, open")
        self.fake.blocked_by[(REPO, 23)] = [20, 21, 40]
        self.fake.blocked_by[(REPO, 22)] = [41]
        detail = self.get()[1]
        blocked = {t["number"]: t["blockedBy"] for t in detail["tickets"]}
        self.assertEqual(blocked[23], [])
        self.assertEqual(blocked[22], [41])  # outside the ticket list: counts by open/closed
        status, out = self.post("/tickets/23/session")
        self.assertEqual(status, 200, out)
        self.assertIn(
            "Ship: together\nBlocked by: #20 (now ready), #21 (now shipped), #40 (closed)\nLoad the skill `phase-build`",
            out["seed"],
        )
        # Still blocked while the blocker is mid-flight.
        self.fake.blocked_by[(REPO, 23)] = [22, 20]
        status, out = self.post("/tickets/23/session")
        self.assertEqual((status, out["code"], out["blockedBy"]), (409, "ticket_blocked", [22]))

    def test_seed_without_blockers_has_no_blocked_line(self):
        self.ticket(20, stage="build")
        status, out = self.post("/tickets/20/session")
        self.assertEqual(status, 200, out)
        self.assertNotIn("Blocked by", out["seed"])

    def test_not_active(self):
        self.ticket(20, stage="ready")
        self.ticket(21, stage="shipped")
        for t in (20, 21):
            status, out = self.post(f"/tickets/{t}/session")
            self.assertEqual((status, out["code"]), (409, "ticket_not_active"), t)

    def test_ready_ticket_in_each_mode_gets_release_session(self):
        self.make_initiative(number=8, phase="delivery", meta={"ship": "each"})
        self.ticket(20, n=8, stage="ready", title="Add CSV export")
        status, out = self.app.dispatch("POST", f"/initiatives/{REPO}/8/tickets/20/session", "{}")
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], "kipo-acme-widgets-8-t20-release")
        self.assertIn('\nStage: release for ticket #20 "Add CSV export"\n', out["seed"])
        self.assertIn("Load the skill `phase-release`", out["seed"])

    def test_not_a_ticket(self):
        self.fake.add_issue(REPO, 50, labels=["bug"])
        status, out = self.post("/tickets/50/session")
        self.assertEqual((status, out["code"]), (404, "not_ticket"))

    def test_without_dependencies_api(self):
        self.ticket(20, stage="build")
        self.fake.graphql_error = "GraphQL: Field 'blockedBy' doesn't exist on type 'Issue'"
        status, out = self.post("/tickets/20/session")
        self.assertEqual(status, 200, out)
        self.assertIn("ticketsNote", self.get()[1])


class TicketAdvanceTests(DeliveryBase):
    def advance_ticket(self, n=7, t=20, force=False):
        return self.app.dispatch(
            "POST", f"/initiatives/{REPO}/{n}/tickets/{t}/advance", json.dumps({"force": force})
        )

    def test_through_every_stage_together(self):
        self.make_initiative(phase="delivery", meta={"ship": "together"})
        self.ticket(20, stage="build")
        for stage, target in (("build", "review"), ("review", "test"), ("test", "security"), ("security", "ready")):
            status, out = self.advance_ticket()
            self.assertEqual((status, out["code"]), (409, "gate_not_passed"), stage)
            write_ticket_state(self.checkout, 7, 20, {**DONE, "phase": stage})
            status, detail = self.advance_ticket()
            self.assertEqual(status, 200, detail)
            self.assertEqual(self.fake.label_set(REPO, 20), {"kipo:7", f"stage:{target}"})
            self.assertTrue(os.path.exists(os.path.join(st.ticket_dir(self.checkout, 7, 20), f"state.{stage}.json")))
            self.assertFalse(os.path.exists(st.ticket_state_path(self.checkout, 7, 20)))
        self.assertEqual(detail["tickets"][0]["stage"], "ready")
        self.assertIsNone(detail["tickets"][0]["sessionKey"])
        # In together mode a ready ticket ships with the initiative, not on its own.
        status, out = self.advance_ticket(force=True)
        self.assertEqual((status, out["code"]), (409, "ticket_not_active"))

    def test_ready_to_shipped_in_each_mode(self):
        self.make_initiative(phase="delivery", meta={"ship": "each"})
        self.ticket(20, stage="ready")
        write_ticket_state(self.checkout, 7, 20, {**DONE, "artifacts": [{"label": "PR", "href": "https://github.com/acme/widgets/pull/5"}]})
        detail = self.get()[1]
        self.assertEqual(detail["tickets"][0]["prUrl"], "https://github.com/acme/widgets/pull/5")
        self.assertEqual(detail["tickets"][0]["sessionKey"], "t20-release")
        status, detail = self.advance_ticket()
        self.assertEqual(status, 200, detail)
        self.assertEqual(self.stage_of(20), "shipped")
        self.assertTrue(os.path.exists(os.path.join(st.ticket_dir(self.checkout, 7, 20), "state.release.json")))
        status, out = self.advance_ticket(force=True)
        self.assertEqual((status, out["code"]), (409, "ticket_not_active"))

    def test_force(self):
        self.make_initiative(phase="delivery")
        self.ticket(20, stage="build")
        status, detail = self.advance_ticket(force=True)
        self.assertEqual(status, 200, detail)
        self.assertEqual(self.stage_of(20), "review")


class DeliveryGateTests(DeliveryBase):
    def test_together(self):
        self.make_initiative(phase="delivery", meta={"ship": "together"})
        self.ticket(20, stage="ready")
        self.ticket(21, stage="security")
        self.ticket(22, state="CLOSED")  # closed without a stage: not counted
        status, out = self.post("/advance")
        self.assertEqual((status, out["code"], out["reason"]), (409, "gate_not_passed", "1 of 2 tickets isn't ready yet."))
        delivery = self.get()[1]["delivery"]
        self.assertEqual((delivery["total"], delivery["canAdvance"]), (2, False))
        self.fake.issues[(REPO, 21)]["labels"] = [{"name": "kipo:7"}, {"name": "stage:shipped"}]
        detail = self.get()[1]
        self.assertTrue(detail["delivery"]["canAdvance"])
        self.assertTrue(detail["gatePassed"])
        self.assertIsNone(detail["delivery"]["reason"])
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "release")
        self.assertEqual(detail["phaseLog"][-1], "2026-11-06 delivery → release")

    def test_each_goes_to_operate(self):
        self.make_initiative(phase="delivery", meta={"ship": "each"})
        self.ticket(20, stage="shipped")
        self.ticket(21, stage="ready")
        status, out = self.post("/advance")
        self.assertEqual((status, out["reason"]), (409, "1 of 2 tickets isn't shipped yet."))
        self.fake.issues[(REPO, 21)]["labels"] = [{"name": "kipo:7"}, {"name": "stage:shipped"}]
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "operate")

    def test_no_tickets(self):
        self.make_initiative(phase="delivery")
        status, out = self.post("/advance")
        self.assertEqual((status, out["reason"]), (409, "There are no tickets yet."))

    def test_force(self):
        self.make_initiative(phase="delivery", meta={"ship": "each"})
        self.ticket(20, stage="build")
        status, detail = self.post("/advance", '{"force": true}')
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "operate")

    def test_release_to_operate_ships_ready_tickets(self):
        self.make_initiative(phase="release", meta={"ship": "together"})
        write_state(self.checkout, 7, DONE)
        self.ticket(20, stage="ready")
        self.ticket(21, stage="ready")
        self.ticket(22, stage="shipped")
        status, detail = self.post("/advance")
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "operate")
        for t in (20, 21, 22):
            self.assertEqual(self.fake.label_set(REPO, t), {"kipo:7", "stage:shipped"}, t)
        self.assertEqual(detail["delivery"]["byStage"]["shipped"], 3)


class ListTests(DeliveryBase):
    def test_tickets_by_stage(self):
        self.make_initiative(number=7, phase="delivery")
        self.make_initiative(number=8, phase="discovery")
        self.make_initiative(number=9, phase="operate")
        self.ticket(20, n=7, stage="build")
        self.ticket(21, n=7, stage="build")
        self.ticket(22, n=7, stage="ready")
        self.ticket(23, n=9, stage="shipped", state="CLOSED")
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200, out)
        by = {i["number"]: i["ticketsByStage"] for i in out["initiatives"]}
        self.assertIsNone(by[8])
        self.assertEqual(by[7], {"build": 2, "review": 0, "test": 0, "security": 0, "ready": 1, "shipped": 0})
        self.assertEqual(by[9]["shipped"], 1)
        self.assertEqual(self.fake.issue_queries, 1)  # one query for the whole repo

    def test_no_query_without_delivery(self):
        self.make_initiative(number=7, phase="design")
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200, out)
        self.assertIsNone(out["initiatives"][0]["ticketsByStage"])
        self.assertEqual(self.fake.issue_queries, 0)


class HistoryTests(DeliveryBase):
    def test_detail_carries_earlier_phases_archived_state(self):
        n = self.make_initiative(phase="refinement")
        folder = os.path.join(self.checkout, ".kipo", str(n))
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "state.intake.json"), "w") as f:
            json.dump({"phase": "intake", "summary": "Sized as a feature."}, f)
        with open(os.path.join(folder, "state.design.json"), "w") as f:
            json.dump({"phase": "design"}, f)  # a later phase: never reported as history
        status, d = self.app.dispatch("GET", f"/initiatives/{REPO}/{n}", "")
        self.assertEqual(status, 200, d)
        self.assertEqual(set(d["history"]), {"intake"})
        self.assertEqual(d["history"]["intake"]["summary"], "Sized as a feature.")


class DocTests(DeliveryBase):
    def setUp(self):
        super().setUp()
        self.make_initiative(phase="design")

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
        # Research notes live on research/<name> branches and are linked as blob URLs.
        self.fake.blobs["origin/research/stock:docs/research/stock.md"] = "# Stock rules\n\nNotes.\n"
        href = f"https://github.com/{REPO}/blob/research/stock/docs/research/stock.md"
        status, out = self.doc(href)
        self.assertEqual(status, 200, out)
        self.assertEqual((out["title"], out["url"]), ("Stock rules", f"https://github.com/{REPO}/blob/research/stock/docs/research/stock.md"))
        status, out = self.doc(f"https://github.com/other/repo/blob/main/x.md")
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
        self.fake.prs[(REPO, 5)] = {"number": 5, "title": "Add export", "body": "PR body", "url": f"https://github.com/{REPO}/pull/5"}
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
            "The map.",
            "",
            "## Tickets",
            "",
            "- ☑ #10 Pick auth (decision)",
            "- ☐ #11 Spike storage (task)",
            "- ☐ #12 Untyped",
        ]))

    def test_href_required(self):
        status, out = self.app.dispatch("GET", f"/initiatives/{REPO}/7/doc", "")
        self.assertEqual((status, out["code"]), (400, "invalid_request"))


if __name__ == "__main__":
    unittest.main()
