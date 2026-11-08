"""The frontier: each ticket's real state, the counts the bar draws, and the fog."""
import unittest

from fakes import FakeGh  # noqa: F401  (puts the backend on sys.path)
from kipo import frontier as fr


def node(n, state="OPEN", labels=(), blockers=(), assigned=False, title=None):
    return {
        "number": n, "title": title or f"T{n}", "url": f"https://x/{n}", "state": state,
        "labels": list(labels), "blockers": [{"number": b, "state": s} for b, s in blockers], "assigned": assigned,
    }


class TypeAndWho(unittest.TestCase):
    def test_types(self):
        self.assertEqual(fr.ticket_type(["wayfinder:research"], False), "research")
        self.assertEqual(fr.ticket_type([], True), "build")
        self.assertEqual(fr.ticket_type([], False), "grilling")
        self.assertEqual(fr.ticket_type(["needs-triage"], False), "issue")
        self.assertEqual(fr.who_for("issue", ["needs-triage"]), "you")
        self.assertEqual(fr.who_for("issue", ["ready-for-agent"]), "afk")

    def test_who(self):
        self.assertEqual(fr.who_for("grilling", []), "you")
        self.assertEqual(fr.who_for("prototype", []), "you")
        self.assertEqual(fr.who_for("research", []), "afk")
        self.assertEqual(fr.who_for("task", []), "you")
        self.assertEqual(fr.who_for("task", ["ready-for-agent"]), "afk")
        self.assertEqual(fr.who_for("build", ["ready-for-agent"]), "afk")
        self.assertEqual(fr.who_for("build", ["ready-for-human"]), "you")


class States(unittest.TestCase):
    def test_every_state(self):
        builds = [
            node(1, state="CLOSED"),
            node(2),                                   # PR open -> review
            node(3),                                   # session -> building
            node(4),                                   # ready -> afk
            node(5, blockers=[(9, "OPEN")]),           # blocked
            node(6, blockers=[(1, "CLOSED")]),         # blocker closed -> afk
        ]
        maps = [
            node(9, labels=["wayfinder:grilling"]),    # you
            node(10, labels=["wayfinder:research"], assigned=True),  # building
            node(3, labels=["wayfinder:grilling"]),    # also a build ticket: counted once
        ]
        prs = [{"number": 50, "state": "OPEN", "tickets": [2]}]
        out = fr.build(builds, maps, prs, {"build-t3": "s3"})
        by = {t["number"]: t for t in out["tiles"]}
        self.assertEqual(
            {n: by[n]["state"] for n in by},
            {1: "done", 2: "review", 3: "building", 4: "afk", 5: "blocked", 6: "afk", 9: "you", 10: "building"},
        )
        self.assertEqual(out["counts"], {"done": 1, "review": 1, "building": 2, "you": 1, "afk": 2, "blocked": 1})
        self.assertEqual(by[5]["blockedBy"], [9])
        self.assertEqual((by[9]["code"], by[10]["code"], by[3]["code"]), ("Gr", "Rs", "Bd"))
        self.assertEqual(by[3]["sessionKey"], "build-t3")
        self.assertEqual(by[2]["prs"], [50])
        # Tiles come in the bar's order: done first.
        self.assertEqual([t["state"] for t in out["tiles"]][:2], ["done", "review"])

    def test_hitl_with_a_session_is_still_your_move(self):
        out = fr.build([], [node(9, labels=["wayfinder:grilling"])], [], {"shape-t9": "s"})
        self.assertEqual(out["tiles"][0]["state"], "you")
        self.assertEqual(out["tiles"][0]["sessionKey"], "shape-t9")


class Fog(unittest.TestCase):
    def test_counts_list_items(self):
        body = "## Destination\nX\n\n## Not yet specified\n<!-- hint -->\n- offline activation\n- license transfer\n\n## Out of scope\n- y\n"
        self.assertEqual(fr.fog_count(body), 2)

    def test_prose_counts_as_one(self):
        self.assertEqual(fr.fog_count("## Not yet specified\nSomething about billing.\n"), 1)

    def test_items_keep_their_text(self):
        body = ("## Not yet specified\n- **Many efforts at once.** One conductor per effort, or one per crew?\n"
                "  More on a second line.\n- Spend limits\n\n## Out of scope\n- y\n")
        self.assertEqual(fr.fog_items(body), [
            "**Many efforts at once.** One conductor per effort, or one per crew? More on a second line.",
            "Spend limits",
        ])
        self.assertEqual(fr.fog_items("## Not yet specified\nSomething about billing.\n"), ["Something about billing."])
        self.assertEqual(fr.fog_items(None), [])

    def test_the_frontier_carries_the_items(self):
        f = fr.build([], [], [], {}, "## Not yet specified\n- a\n- b\n")
        self.assertEqual((f["fog"], f["fogItems"]), (2, ["a", "b"]))

    def test_a_closed_maps_fog_is_left_over_not_pending(self):
        f = fr.build([], [], [], {}, "## Not yet specified\n- a\n- b\n", map_closed=True)
        self.assertEqual((f["fog"], f["fogItems"], f["fogLeft"]), (0, [], ["a", "b"]))
        open_map = fr.build([], [], [], {}, "## Not yet specified\n- a\n")
        self.assertEqual((open_map["fog"], open_map["fogLeft"]), (1, []))

    def test_none(self):
        self.assertEqual(fr.fog_count("## Not yet specified\n<!-- empty -->\n\n## Out of scope\n"), 0)
        self.assertEqual(fr.fog_count(None), 0)


if __name__ == "__main__":
    unittest.main()


class Lanes(unittest.TestCase):
    def test_lane_rule(self):
        self.assertEqual(fr.lane_for("build", [], False), "deliver")
        self.assertEqual(fr.lane_for("grilling", [], False), "decide")
        self.assertEqual(fr.lane_for("task", [], False), "decide")
        self.assertEqual(fr.lane_for("task", ["ready-for-agent"], False), "deliver")
        self.assertEqual(fr.lane_for("task", [], True), "deliver")  # it ends in a PR
        self.assertEqual(fr.lane_for("research", [], False), "decide")

    def test_lanes_and_keys(self):
        maps = [node(22, labels=["wayfinder:task", "ready-for-agent"]), node(24, labels=["wayfinder:grilling"])]
        out = fr.build([node(40)], maps, [], {})
        by = {t["number"]: t for t in out["tiles"]}
        self.assertEqual({n: by[n]["lane"] for n in by}, {22: "deliver", 24: "decide", 40: "deliver"})
        self.assertEqual(out["lanes"]["deliver"]["afk"], 2)
        self.assertEqual(out["lanes"]["decide"]["you"], 1)

    def test_source_issue_is_a_tile(self):
        src = node(22, labels=["needs-triage"])
        out = fr.build([], [], [], {}, source_node=src)
        t = out["tiles"][0]
        self.assertEqual((t["type"], t["lane"], t["who"], t["source"]), ("issue", "decide", "you", True))
        ready = fr.build([], [], [], {}, source_node=node(22, labels=["ready-for-agent"]))["tiles"][0]
        self.assertEqual((ready["lane"], ready["state"]), ("deliver", "afk"))


class Stage(unittest.TestCase):
    def front(self, builds=(), maps=(), prs=(), fog_body=None):
        return fr.build(list(builds), list(maps), list(prs), {}, fog_body)

    def test_both_halves_active(self):
        f = self.front([node(40)], [node(24, labels=["wayfinder:grilling"])])
        s = fr.stage_of(f, "build")
        self.assertEqual((s["stage"], s["active"]), ("decide", {"decide": True, "deliver": True}))

    def test_fog_keeps_decide_open(self):
        f = self.front([], [node(24, state="CLOSED")], fog_body="## Not yet specified\n- x\n")
        self.assertEqual(fr.stage_of(f, "shape")["stage"], "decide")
        self.assertFalse(fr.stage_of(f, "shape")["handover"])

    def test_handover_when_the_map_is_clear(self):
        f = self.front([], [node(24, state="CLOSED")])
        s = fr.stage_of(f, "shape")
        self.assertTrue(s["handover"])
        self.assertEqual(s["stage"], "decide")

    def test_deliver_then_landed(self):
        f = self.front([node(40, state="CLOSED"), node(41)], [node(24, state="CLOSED")])
        self.assertEqual(fr.stage_of(f, "plan")["stage"], "deliver")
        f = self.front([node(40, state="CLOSED"), node(41, state="CLOSED")], [node(24, state="CLOSED")])
        s = fr.stage_of(f, "plan")
        self.assertEqual((s["stage"], s["landed"]), ("done", True))

    def test_no_tickets_falls_back_to_the_column(self):
        empty = self.front()
        self.assertEqual(fr.stage_of(empty, "grill")["stage"], "decide")
        self.assertEqual(fr.stage_of(empty, "intake")["stage"], "intake")
        self.assertEqual(fr.stage_of(empty, "build")["stage"], "deliver")
        # A small change's own PR on kipo/<n> is its Deliver half.
        s = fr.stage_of(empty, "grill", [{"number": 5, "state": "OPEN", "tickets": []}])
        self.assertEqual(s["stage"], "deliver")
        s = fr.stage_of(empty, "review", [{"number": 5, "state": "MERGED", "tickets": []}])
        self.assertEqual((s["stage"], s["landed"]), ("done", True))
