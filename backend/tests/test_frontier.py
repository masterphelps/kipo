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

    def test_none(self):
        self.assertEqual(fr.fog_count("## Not yet specified\n<!-- empty -->\n\n## Out of scope\n"), 0)
        self.assertEqual(fr.fog_count(None), 0)


if __name__ == "__main__":
    unittest.main()
