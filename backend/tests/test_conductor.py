"""The conductor's frontier: open threads, who holds each, and what's next."""
import unittest

from fakes import FakeGh  # noqa: F401  (puts the backend on sys.path)
from kipo import conductor


def tile(n, state, type_="task", lane="decide", blocked_by=(), source=False):
    return {"number": n, "title": f"T{n}", "type": type_, "lane": lane, "state": state,
            "blockedBy": list(blocked_by), "source": source}


def detail(tiles, prs=(), fog=(), left=(), spec=None):
    return {"frontier": {"tiles": list(tiles), "fogItems": list(fog), "fogLeft": list(left)},
            "prs": list(prs), "specPath": spec}


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


if __name__ == "__main__":
    unittest.main()
