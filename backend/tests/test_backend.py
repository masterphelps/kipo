import hashlib
import hmac
import json
import os
import shutil
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

from fakes import FakeGh

import server
from kipo import initiatives as ini
from kipo import state as st
from kipo.gh import Gh
from kipo.storage import Storage

REPO = "acme/widgets"


def write_state(repo_path, number, data):
    os.makedirs(st.state_dir(repo_path, number), exist_ok=True)
    with open(st.state_path(repo_path, number), "w") as f:
        json.dump(data, f)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.checkout = os.path.join(self.tmp, "widgets")
        os.makedirs(self.checkout)
        self.fake = FakeGh(git_checkouts={self.checkout})
        self.storage = Storage(os.path.join(self.tmp, "data"))
        self.storage.save_config({"repos": [{"slug": REPO, "path": self.checkout}]})
        self.app = server.App(gh=Gh(self.fake), storage=self.storage, clock=lambda: "2026-11-06")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def make_initiative(self, number=7, phase="intake", meta=None, log=None, artifacts=None, labels=()):
        body = {
            "destination": "Ship widgets.",
            "artifacts": artifacts or [],
            "phaseLog": log or ["2026-11-01 created in intake"],
            "meta": {**ini.default_meta(), "repoPath": self.checkout, **(meta or {})},
        }
        self.fake.add_issue(
            REPO, number, title="Widgets", body=ini.render_body(body),
            labels=[ini.INITIATIVE_LABEL, f"phase:{phase}", *labels],
        )
        return number


class BodyTests(unittest.TestCase):
    def test_round_trip(self):
        body = {
            "destination": "Let people export widgets as CSV.\nWithout a login.",
            "artifacts": [
                {"label": "Spec", "href": "docs/specs/export.md"},
                {"label": "Odd [label]", "href": "/Users/me/My Docs/plan (v2).md"},
            ],
            "phaseLog": ["2026-11-06 created in intake", "2026-11-06 intake → discovery"],
            "meta": {"repoPath": "/abs/path", "size": "feature", "mapIssue": 12, "specPath": "docs/specs/export.md"},
        }
        self.assertEqual(ini.parse_body(ini.render_body(body)), body)

    def test_round_trip_empty_lists(self):
        body = {"destination": "x", "artifacts": [], "phaseLog": [], "meta": ini.default_meta()}
        self.assertEqual(ini.parse_body(ini.render_body(body)), body)

    def test_meta_is_last_line(self):
        text = ini.render_body({"destination": "x", "meta": {"repoPath": "/a-->b"}})
        last = text.splitlines()[-1]
        self.assertTrue(last.startswith("<!-- kipo:meta {"))
        self.assertEqual(last.count("-->"), 1)
        self.assertEqual(ini.parse_body(text)["meta"]["repoPath"], "/a-->b")

    def test_parse_tolerates_missing_meta(self):
        parsed = ini.parse_body("## Destination\n\nHello\n")
        self.assertEqual(parsed["destination"], "Hello")
        self.assertEqual(parsed["meta"], ini.default_meta())


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_passed(self):
        write_state(self.tmp, 3, {"gate": [{"id": "a", "done": True}, {"id": "b", "done": True}]})
        self.assertTrue(st.gate_passed(st.read_state(self.tmp, 3)))

    def test_not_passed(self):
        write_state(self.tmp, 3, {"gate": [{"id": "a", "done": True}, {"id": "b", "done": False}]})
        self.assertFalse(st.gate_passed(st.read_state(self.tmp, 3)))

    def test_empty_gate_not_passed(self):
        write_state(self.tmp, 3, {"gate": []})
        self.assertFalse(st.gate_passed(st.read_state(self.tmp, 3)))

    def test_missing_file(self):
        self.assertIsNone(st.read_state(self.tmp, 3))
        self.assertFalse(st.gate_passed(None))

    def test_unreadable_file(self):
        os.makedirs(st.state_dir(self.tmp, 3))
        with open(st.state_path(self.tmp, 3), "w") as f:
            f.write("{nope")
        self.assertIsNone(st.read_state(self.tmp, 3))


class AdvanceTests(Base):
    def test_advance_moves_label_archives_logs_and_merges(self):
        n = self.make_initiative(artifacts=[{"label": "Brief", "href": "docs/brief.md"}])
        write_state(self.checkout, n, {
            "phase": "intake",
            "gate": [{"id": "g", "label": "Done", "done": True}],
            "artifacts": [{"label": "Brief again", "href": "docs/brief.md"}, {"label": "Map", "href": "https://x/1"}],
            "size": "foggy",
        })
        status, detail = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/advance", "{}")
        self.assertEqual(status, 200, detail)
        labels = self.fake.label_set(REPO, n)
        self.assertIn("phase:discovery", labels)
        self.assertNotIn("phase:intake", labels)
        self.assertIn("size:foggy", labels)
        self.assertIn((REPO, "phase:discovery"), self.fake.labels)
        self.assertIn((REPO, "size:foggy"), self.fake.labels)

        self.assertEqual(detail["phase"], "discovery")
        self.assertEqual(detail["size"], "foggy")
        self.assertEqual(detail["phaseLog"][-1], "2026-11-06 intake → discovery")
        self.assertEqual(
            detail["artifacts"],
            [{"label": "Brief", "href": "docs/brief.md"}, {"label": "Map", "href": "https://x/1"}],
        )
        body = ini.parse_body(self.fake.issues[(REPO, n)]["body"])
        self.assertEqual(body["meta"]["size"], "foggy")
        self.assertEqual(len(body["artifacts"]), 2)

        self.assertFalse(os.path.exists(st.state_path(self.checkout, n)))
        self.assertTrue(os.path.exists(os.path.join(st.state_dir(self.checkout, n), "state.intake.json")))
        self.assertIsNone(detail["state"])
        self.assertFalse(detail["gatePassed"])

    def test_409_when_gate_not_passed(self):
        n = self.make_initiative()
        write_state(self.checkout, n, {"gate": [{"id": "g", "done": False}]})
        status, payload = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/advance", '{"force": false}')
        self.assertEqual(status, 409)
        self.assertEqual(payload["code"], "gate_not_passed")
        self.assertIn("error", payload)
        self.assertIn("phase:intake", self.fake.label_set(REPO, n))
        self.assertTrue(os.path.exists(st.state_path(self.checkout, n)))

    def test_409_when_state_missing(self):
        n = self.make_initiative()
        status, payload = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/advance", "")
        self.assertEqual((status, payload["code"]), (409, "gate_not_passed"))

    def test_force_advances_without_gate(self):
        n = self.make_initiative(phase="refinement")
        status, detail = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/advance", '{"force": true}')
        self.assertEqual(status, 200, detail)
        self.assertEqual(detail["phase"], "design")

    def test_advance_from_operate_closes_issue(self):
        n = self.make_initiative(phase="operate")
        write_state(self.checkout, n, {"gate": [{"id": "g", "done": True}]})
        status, detail = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/advance", "{}")
        self.assertEqual(status, 200, detail)
        self.assertEqual(self.fake.issues[(REPO, n)]["state"], "CLOSED")
        self.assertEqual(detail["phaseLog"][-1], "2026-11-06 operate → closed")
        self.assertTrue(os.path.exists(os.path.join(st.state_dir(self.checkout, n), "state.operate.json")))

    def test_not_an_initiative(self):
        self.fake.add_issue(REPO, 99, labels=["bug"])
        status, payload = self.app.dispatch("GET", f"/initiatives/{REPO}/99", "")
        self.assertEqual((status, payload["code"]), (404, "not_initiative"))


class EndpointTests(Base):
    def test_create_and_list(self):
        status, created = self.app.dispatch(
            "POST", "/initiatives", json.dumps({"repo": REPO, "title": "Export", "destination": "CSV export."})
        )
        self.assertEqual(status, 200, created)
        self.assertEqual(created["phase"], "intake")
        self.assertIsNone(created["size"])
        self.assertEqual(created["destination"], "CSV export.")
        body = ini.parse_body(self.fake.issues[(REPO, created["number"])]["body"])
        self.assertEqual(body["phaseLog"], ["2026-11-06 created in intake"])
        self.assertEqual(body["meta"]["repoPath"], self.checkout)

        status, listed = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200)
        self.assertEqual([i["number"] for i in listed["initiatives"]], [created["number"]])

    def test_create_unknown_repo(self):
        status, payload = self.app.dispatch(
            "POST", "/initiatives", json.dumps({"repo": "other/repo", "title": "x", "destination": "y"})
        )
        self.assertEqual((status, payload["code"]), (404, "unknown_repo"))

    def test_put_config_validates(self):
        status, payload = self.app.dispatch("PUT", "/config", json.dumps({"repos": [{"slug": REPO, "path": self.tmp}]}))
        self.assertEqual((status, payload["code"]), (400, "invalid_config"))
        status, payload = self.app.dispatch(
            "PUT", "/config", json.dumps({"repos": [{"slug": REPO, "path": "/does/not/exist"}]})
        )
        self.assertEqual((status, payload["code"]), (400, "invalid_config"))
        status, payload = self.app.dispatch("PUT", "/config", json.dumps({"repos": [{"slug": REPO, "path": self.checkout}]}))
        self.assertEqual(status, 200)
        self.assertEqual(self.app.dispatch("GET", "/config", "")[1], payload)

    def test_detail_merges_state(self):
        n = self.make_initiative()
        write_state(self.checkout, n, {"gate": [{"id": "g", "done": True}], "artifacts": [{"label": "S", "href": "s.md"}]})
        status, detail = self.app.dispatch("GET", f"/initiatives/{REPO}/{n}", "")
        self.assertEqual(status, 200)
        self.assertTrue(detail["gatePassed"])
        self.assertEqual(detail["artifacts"], [{"label": "S", "href": "s.md"}])
        self.assertEqual(detail["repoPath"], self.checkout)

    def test_derive_meta_from_artifacts(self):
        meta = ini.derive_meta(
            {"mapIssue": None, "specPath": None},
            [
                {"label": "Wayfinder map", "href": f"https://github.com/{REPO}/issues/7"},
                {"label": "Spec", "href": "docs/specs/widgets.md"},
            ],
        )
        self.assertEqual(meta["mapIssue"], 7)
        self.assertEqual(meta["specPath"], "docs/specs/widgets.md")
        kept = ini.derive_meta({"mapIssue": 3, "specPath": "a.md"}, [{"label": "Spec", "href": "b.md"}])
        self.assertEqual((kept["mapIssue"], kept["specPath"]), (3, "a.md"))

    def test_session_records_and_seeds(self):
        n = self.make_initiative(phase="discovery")
        status, out = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/session", '{"phase": "discovery", "ticket": null}')
        self.assertEqual(status, 200, out)
        self.assertEqual(out["slotName"], f"kipo-acme-widgets-{n}-discovery")
        self.assertEqual(
            out["seed"],
            "\n".join([
                f'[KiPo] Initiative #{n} "Widgets" in {REPO}',
                "Phase: discovery (2 of 7)",
                f"Repo checkout: {self.checkout}",
                f"Initiative issue: https://github.com/{REPO}/issues/{n}",
                f"State file: {self.checkout}/.kipo/{n}/state.json",
                "Size: unset",
                "Load the skill `phase-discovery` and follow it. Destination: Ship widgets.",
            ]),
        )
        status, out = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/session", '{"phase": "discovery", "ticket": 42}')
        self.assertEqual(out["slotName"], f"kipo-acme-widgets-{n}-discovery-t42")
        self.assertIn("Size: unset\nTicket: #42\nLoad the skill `phase-discovery`", out["seed"])
        sessions = self.app.dispatch("GET", f"/initiatives/{REPO}/{n}", "")[1]["sessions"]
        self.assertEqual(sessions, {
            "discovery": f"kipo-acme-widgets-{n}-discovery",
            "discovery-t42": f"kipo-acme-widgets-{n}-discovery-t42",
        })

    def test_session_seed_carries_ship(self):
        n = self.make_initiative(phase="release", meta={"ship": "together"})
        status, out = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/session", "{}")
        self.assertEqual(status, 200, out)
        self.assertIn("Phase: release (6 of 7)", out["seed"])
        self.assertIn("Size: unset\nShip: together\nLoad the skill `phase-release`", out["seed"])

    def test_session_bad_phase(self):
        n = self.make_initiative()
        for phase in ("deploy", "build", "delivery"):
            status, payload = self.app.dispatch("POST", f"/initiatives/{REPO}/{n}/session", json.dumps({"phase": phase}))
            self.assertEqual((status, payload["code"]), (400, "invalid_phase"), phase)

    def test_frontier_without_map_is_empty(self):
        n = self.make_initiative()
        self.fake.add_issue(REPO, 20, title="Ticket", labels=[f"kipo:{n}", "wayfinder:task"])
        status, out = self.app.dispatch("GET", f"/initiatives/{REPO}/{n}/frontier", "")
        self.assertEqual(status, 200, out)
        self.assertEqual(out["tickets"], [])

    def _map_response(self):
        def node(number, state="OPEN", assignees=0, blockers=(), labels=()):
            return {
                "number": number, "title": f"T{number}", "url": f"https://github.com/{REPO}/issues/{number}",
                "state": state, "assignees": {"totalCount": assignees},
                "labels": {"nodes": [{"name": l} for l in labels]},
                "blockedBy": {"nodes": [{"state": s} for s in blockers]},
            }
        return {"data": {"repository": {"issue": {"subIssues": {"nodes": [
            node(30, labels=["wayfinder:decision"]),
            node(31, state="CLOSED"),
            node(32, assignees=1),
            node(33, blockers=["OPEN"]),
            node(34, blockers=["CLOSED"]),
        ]}}}}}

    def test_frontier_from_map(self):
        n = self.make_initiative(meta={"mapIssue": 12})
        self.fake.graphql_response = self._map_response()
        status, out = self.app.dispatch("GET", f"/initiatives/{REPO}/{n}/frontier", "")
        self.assertEqual(status, 200, out)
        self.assertEqual([t["number"] for t in out["tickets"]], [30, 34])
        self.assertEqual(out["tickets"][0]["type"], "decision")
        self.assertNotIn("note", out)

    def test_frontier_from_map_without_dependencies_api(self):
        n = self.make_initiative(meta={"mapIssue": 12})
        self.fake.graphql_response = self._map_response()
        self.fake.graphql_error = "GraphQL: Field 'blockedBy' doesn't exist on type 'Issue'"
        status, out = self.app.dispatch("GET", f"/initiatives/{REPO}/{n}/frontier", "")
        self.assertEqual(status, 200, out)
        self.assertIn("note", out)

    def test_errors_are_json(self):
        self.assertEqual(self.app.dispatch("GET", "/nope", "")[1]["code"], "not_found")
        self.assertEqual(self.app.dispatch("DELETE", "/config", "")[1]["code"], "method_not_allowed")
        self.assertEqual(self.app.dispatch("PUT", "/config", "{bad")[1]["code"], "invalid_json")
        self.assertEqual(self.app.dispatch("GET", "/initiatives/acme/widgets/404", "")[1]["code"], "not_found")


class PrefixTests(unittest.TestCase):
    def test_strip(self):
        for raw in (
            "/apps/kipo/api/initiatives",
            "/api/apps/kipo/initiatives",
            "/api/initiatives",
            "/initiatives",
            "/initiatives/",
            "/api/initiatives?x=1",
        ):
            self.assertEqual(server.strip_prefix(raw), "/initiatives", raw)
        self.assertEqual(server.strip_prefix("/api/apps/kipo/health"), "/health")
        self.assertEqual(server.strip_prefix("/api"), "/")
        self.assertEqual(server.strip_prefix("/apiary"), "/apiary")


class NamingTests(unittest.TestCase):
    def test_session_name(self):
        self.assertEqual(ini.session_name("Acme/My.Repo", 7, "discovery"), "kipo-acme-my-repo-7-discovery")
        self.assertEqual(ini.session_name("acme/widgets", 7, "review", 31), "kipo-acme-widgets-7-review-t31")
        self.assertEqual(ini.session_key("build", 3), "build-t3")
        self.assertEqual(ini.session_key("build"), "build")


class HttpTests(Base):
    """The real server: prefixes, proxy auth and unauthenticated /health."""

    def setUp(self):
        super().setUp()
        self.secret = "s3cret"
        os.environ["KIROCREW_PROXY_SECRET"] = self.secret
        self.httpd = server.make_server(self.app, port=0)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        os.environ.pop("KIROCREW_PROXY_SECRET", None)
        super().tearDown()

    def request(self, method, path, body=b"", sign=True):
        headers = {}
        if sign:
            ts = str(int(time.time()))
            msg = f"{ts}:{method}:{path}:{hashlib.sha256(body).hexdigest()}"
            headers["X-KiroCrew-Proxy"] = f"{ts}:" + hmac.new(self.secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=body or None, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_health_unauthenticated(self):
        self.assertEqual(self.request("GET", "/health", sign=False), (200, {"status": "ok"}))

    def test_unsigned_rejected(self):
        status, payload = self.request("GET", "/apps/kipo/api/config", sign=False)
        self.assertEqual((status, payload["code"]), (401, "unauthorized"))

    def test_signed_with_prefixes(self):
        for prefix in ("/apps/kipo/api", "/api/apps/kipo", "/api", ""):
            status, payload = self.request("GET", f"{prefix}/config")
            self.assertEqual(status, 200, prefix)
            self.assertEqual(payload["repos"][0]["slug"], REPO)

    def test_tampered_body_rejected(self):
        ts = str(int(time.time()))
        msg = f"{ts}:PUT:/config:{hashlib.sha256(b'{}').hexdigest()}"
        sig = hmac.new(self.secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/config", data=b'{"repos":[]}', method="PUT",
            headers={"X-KiroCrew-Proxy": f"{ts}:{sig}"},
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 401)
        ctx.exception.close()


if __name__ == "__main__":
    unittest.main()
