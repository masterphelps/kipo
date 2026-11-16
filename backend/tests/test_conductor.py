"""The conductor's frontier: open threads, who holds each, and what's next."""
import unittest

from fakes import FakeGh  # noqa: F401  (puts the backend on sys.path)
from kipo import conductor


def tile(n, state, type_="task", lane="decide", blocked_by=(), source=False):
    return {"number": n, "title": f"T{n}", "type": type_, "lane": lane, "state": state,
            "blockedBy": list(blocked_by), "source": source}


def detail(tiles, prs=(), fog=(), left=(), spec=None, column=None, path=None, sessions=None, closing=None):
    d = {"frontier": {"tiles": list(tiles), "fogItems": list(fog), "fogLeft": list(left)},
         "prs": list(prs), "specPath": spec}
    if column:
        d.update(column=column, path=list(path or ()), sessions=dict(sessions or {}), closing=list(closing or ()))
    return d


IDEA = ("grill", "plan", "build", "review", "done")


class Threads(unittest.TestCase):
    def test_effort_34_today(self):
        # Every map ticket closed, the map closed with two leftovers, one PR closing no ticket.
        d = detail([tile(n, "done") for n in range(21, 31)],
                   prs=[{"number": 33, "state": "MERGED", "tickets": [22]},
                        {"number": 45, "state": "OPEN", "tickets": [], "title": "Drop the default"}],
                   left=["A portal view", "Tenant quota"])
        r = conductor.threads(d)
        ids = [t["id"] for t in r["threads"]]
        self.assertEqual(ids, ["pr45", "leftover", "retro"])
        self.assertEqual(r["threads"][0]["owner"], "Agent")
        self.assertEqual(r["threads"][1]["owner"], "HITL")
        self.assertEqual(r["threads"][2]["owner"], "Blocked")
        self.assertEqual(r["done"], {"tickets": 10, "of": 10, "prsMerged": 1})
        self.assertIn("1 needs the human", r["where"])

    def test_states_become_owners_and_stages(self):
        d = detail([
            tile(1, "you", "grilling"),
            tile(2, "afk", "research"),
            tile(3, "blocked", "task", blocked_by=[1]),
            tile(4, "afk", "build", "deliver"),
            tile(5, "building", "build", "deliver"),
            tile(6, "review", "build", "deliver"),
            tile(7, "you", "build", "deliver"),
        ])
        by = {t["id"]: t for t in conductor.threads(d)["threads"]}
        self.assertEqual((by["t1"]["stage"], by["t1"]["owner"]), ("grill", "HITL"))
        self.assertEqual((by["t2"]["stage"], by["t2"]["owner"]), ("shape", "Agent"))
        self.assertEqual((by["t3"]["owner"], by["t3"]["waitsOn"]), ("Blocked", [1]))
        self.assertEqual((by["t4"]["stage"], by["t4"]["skill"]), ("build", "kipo-build"))
        self.assertEqual(by["t5"]["owner"], "Running")
        self.assertEqual((by["t6"]["stage"], by["t6"]["skill"]), ("review", "kipo-review"))
        self.assertEqual((by["t7"]["stage"], by["t7"]["owner"]), ("build", "HITL"))

    def test_fog_and_handover(self):
        foggy = conductor.threads(detail([tile(1, "done")], fog=["Offline activation"]))
        self.assertIn("fog", [t["id"] for t in foggy["threads"]])
        self.assertNotIn("handover", [t["id"] for t in foggy["threads"]])
        clear = conductor.threads(detail([tile(1, "done"), tile(2, "done", "grilling")]))
        handover = [t for t in clear["threads"] if t["id"] == "handover"]
        self.assertEqual(handover[0]["owner"], "HITL")
        cut = conductor.threads(detail([tile(1, "done"), tile(3, "afk", "build", "deliver")]))
        self.assertNotIn("handover", [t["id"] for t in cut["threads"]])

    def test_all_done_means_retro(self):
        r = conductor.threads(detail([tile(1, "done"), tile(2, "done", "build", "deliver")]))
        self.assertEqual([t["id"] for t in r["threads"]], ["retro"])
        self.assertEqual(r["threads"][0]["owner"], "Agent")
        self.assertIn("retro", r["where"])

    def test_pr_with_a_ticket_is_not_a_stray(self):
        d = detail([tile(4, "review", "build", "deliver")], prs=[{"number": 9, "state": "OPEN", "tickets": [4]}])
        self.assertNotIn("pr9", [t["id"] for t in conductor.threads(d)["threads"]])


def ref_pr(n, refs, state="OPEN"):
    return {"number": n, "state": state, "tickets": [], "refs": list(refs), "title": f"docs: ADR (#{refs[0]})"}


class PrNamingATicket(unittest.TestCase):
    """#201: PRs #609/#611/#612 name #208 in their title, close nothing. Each is a
    review thread for #208 (kipo-review, Agent), even with #208 closed."""

    def _d(self, **kw):
        d = detail([tile(208, "done", "grilling"), tile(212, "you", "grilling")], **kw)
        d["refPrs"] = [ref_pr(609, [208]), ref_pr(611, [208]), ref_pr(612, [208])]
        return d

    def test_each_is_a_review_thread_for_its_ticket(self):
        r = conductor.threads(self._d())
        by = {t["id"]: t for t in r["threads"]}
        self.assertEqual([i for i in by if i.startswith("pr")], ["pr609", "pr611", "pr612"])
        th = by["pr609"]
        self.assertEqual((th["kind"], th["pr"], th["ticket"], th["stage"], th["skill"], th["owner"]),
                         ("pr", 609, 208, "review", "kipo-review", "Agent"))
        self.assertIn("--ticket 208 --skill kipo-review", th["action"])
        self.assertNotIn("closes no ticket", th["action"])
        self.assertEqual(by["retro"]["owner"], "Blocked")

    def test_merged_ones_are_not_threads(self):
        d = self._d()
        d["refPrs"] = [ref_pr(609, [208], "MERGED")]
        self.assertNotIn("pr609", [t["id"] for t in conductor.threads(d)["threads"]])

    def test_its_review_conversation_running_owns_it(self):
        d = self._d(column="grill", path=IDEA, sessions={"review-t208": "slot"},
                    closing=[{"key": "review-t208", "status": "open"}])
        th = next(t for t in conductor.threads(d)["threads"] if t["id"] == "pr609")
        self.assertEqual((th["owner"], th["session"]), ("Running", "review-t208"))

    def test_the_effort_review_conversation_owns_it_when_there_is_no_ticket_review(self):
        row = {"key": "review", "status": "open", "stall": {"state": "stuck", "why": "woken 2 times with no answer"}}
        d = self._d(column="grill", path=IDEA, sessions={"review": "slot"}, closing=[row])
        th = next(t for t in conductor.threads(d)["threads"] if t["id"] == "pr609")
        self.assertEqual((th["owner"], th["session"], th["stall"]), ("Stalled", "review", "stuck"))
        self.assertIn("--stage review", th["action"])

    def test_a_pr_closing_no_ticket_and_naming_none_is_still_a_stray(self):
        d = self._d(prs=[{"number": 45, "state": "OPEN", "tickets": [], "title": "Drop the default"}])
        th = next(t for t in conductor.threads(d)["threads"] if t["id"] == "pr45")
        self.assertIn("closes no ticket", th["action"])



class NoTicketsYet(unittest.TestCase):
    """Zero tickets is never "every ticket is done": #1054, an idea just created."""

    def test_new_idea_gets_a_grill_thread_and_no_retro(self):
        r = conductor.threads(detail([], column="grill", path=IDEA))
        self.assertEqual([t["id"] for t in r["threads"]], ["grill"])
        g = r["threads"][0]
        self.assertEqual((g["kind"], g["stage"], g["skill"], g["owner"]), ("stage", "grill", "kipo-grill", "Agent"))
        self.assertEqual(g["action"], "dispatch kipo-grill: grill the idea with the human")
        self.assertNotIn("Every ticket is done", r["where"])
        self.assertIn("1 ready for an agent", r["where"])
        self.assertEqual(r["done"], {"tickets": 0, "of": 0, "prsMerged": 0})

    def test_new_issue_gets_an_intake_thread(self):
        r = conductor.threads(detail([], column="intake", path=("intake", "build", "review", "done")))
        self.assertEqual([(t["id"], t["skill"], t["owner"]) for t in r["threads"]],
                         [("intake", "kipo-intake", "Agent")])
        self.assertNotIn("Every ticket is done", r["where"])

    def test_huge_effort_without_a_map_gets_a_shape_thread(self):
        r = conductor.threads(detail([], column="shape", path=("shape", "plan", "build", "review", "done")))
        self.assertEqual([(t["id"], t["skill"]) for t in r["threads"]], [("shape", "kipo-shape")])

    def test_grill_running_is_not_dispatched_again(self):
        r = conductor.threads(detail([], column="grill", path=IDEA, sessions={"grill": "slot"},
                                     closing=[{"key": "grill", "status": "open"}]))
        self.assertEqual([(t["id"], t["owner"]) for t in r["threads"]], [("grill", "Running")])

    def test_grill_stalled_says_so(self):
        row = {"key": "grill", "status": "open", "stall": {"state": "stalled", "why": "idle 20 min"}}
        r = conductor.threads(detail([], column="grill", path=IDEA, sessions={"grill": "slot"}, closing=[row]))
        g = r["threads"][0]
        self.assertEqual((g["owner"], g["session"], g["stall"]), ("Stalled", "grill", "stalled"))

    def test_grill_finished_means_the_handover(self):
        r = conductor.threads(detail([], column="grill", path=IDEA, sessions={"grill": "slot"},
                                     closing=[{"key": "grill", "status": "closable"}]))
        self.assertEqual([(t["id"], t["stage"], t["owner"]) for t in r["threads"]], [("handover", "plan", "HITL")])

    def test_plan_without_spec_or_tickets_is_the_handover(self):
        r = conductor.threads(detail([], column="plan", path=IDEA))
        self.assertEqual([t["id"] for t in r["threads"]], ["handover"])
        self.assertNotIn("Every ticket is done", r["where"])

    def test_no_tickets_past_planning_still_never_all_done(self):
        r = conductor.threads(detail([], column="build", path=IDEA))
        self.assertNotIn("Every ticket is done", r["where"])

    def test_with_a_map_or_spec_the_old_rules_hold(self):
        r = conductor.threads(detail([], column="grill", path=IDEA, fog=["Offline activation"]))
        self.assertEqual([t["id"] for t in r["threads"]], ["fog", "retro"])


if __name__ == "__main__":
    unittest.main()
