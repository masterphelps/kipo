import json
import os
import shutil
import tempfile
import unittest

from fakes import FakeGh

import server
from kipo import initiatives as ini
from kipo import repos
from kipo.gh import Gh
from kipo.storage import Storage


def make_checkout(path, url=None):
    os.makedirs(os.path.join(path, ".git"))
    config = "[core]\n\tbare = false\n"
    if url:
        config += f'[remote "origin"]\n\turl = {url}\n'
    with open(os.path.join(path, ".git", "config"), "w") as f:
        f.write(config)


class SlugTest(unittest.TestCase):
    def test_github_urls(self):
        for url in (
            "git@github.com:acme/widgets.git",
            "https://github.com/acme/widgets",
            "https://github.com/acme/widgets.git",
            "https://token@github.com/acme/widgets.git",
            "ssh://git@github.com/acme/widgets.git",
        ):
            self.assertEqual(repos.github_slug(url), "acme/widgets", url)

    def test_other_urls(self):
        for url in (None, "", "git@gitlab.com:acme/widgets.git", "/srv/git/widgets"):
            self.assertIsNone(repos.github_slug(url), url)


class RepoRoutesTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp()
        self.root = os.path.join(self.home, "repos")
        make_checkout(os.path.join(self.root, "widgets"), "git@github.com:acme/widgets.git")
        make_checkout(os.path.join(self.root, "local-only"))
        make_checkout(os.path.join(self.root, "group", "gadgets"), "https://github.com/acme/gadgets")
        os.makedirs(os.path.join(self.root, "node_modules", "pkg", ".git"))
        os.makedirs(os.path.join(self.root, "plain-folder"))
        self.storage = Storage(os.path.join(self.home, "data"))
        self.fake = FakeGh()
        self.app = server.App(gh=Gh(self.fake), storage=self.storage, repo_roots=(self.root,), home=self.home)

    def tearDown(self):
        shutil.rmtree(self.home)

    def test_discover_lists_checkouts_with_slugs(self):
        status, out = self.app.dispatch("GET", "/repos/discover", "")
        self.assertEqual(status, 200, out)
        by_name = {r["name"]: r for r in out["repos"]}
        self.assertEqual(set(by_name), {"widgets", "gadgets", "local-only"})
        self.assertEqual(by_name["widgets"]["slug"], "acme/widgets")
        self.assertIsNone(by_name["local-only"]["slug"])
        self.assertFalse(by_name["widgets"]["configured"])

    def test_discover_counts_each_repos_open_wayfinder_maps(self):
        self.fake.add_issue("acme/widgets", 5, labels=["wayfinder:map"])
        self.fake.add_issue("acme/widgets", 6, labels=["wayfinder:map"])
        self.fake.add_issue("acme/widgets", 7, labels=["wayfinder:map"], state="CLOSED")
        self.fake.add_issue("acme/gadgets", 8, labels=["wayfinder:grilling"])
        by_name = {r["name"]: r for r in self.app.dispatch("GET", "/repos/discover", "")[1]["repos"]}
        self.assertEqual((by_name["widgets"]["maps"], by_name["gadgets"]["maps"]), (2, 0))
        self.assertNotIn("maps", by_name["local-only"])

    def test_discover_still_works_when_the_map_search_fails(self):
        self.fake.search_error = True
        status, out = self.app.dispatch("GET", "/repos/discover", "")
        self.assertEqual(status, 200, out)
        self.assertTrue(all("maps" not in r for r in out["repos"]))

    def test_the_tree_nests_maps_and_efforts_under_each_added_repo(self):
        widgets = os.path.join(self.root, "widgets")
        self.app.dispatch("POST", "/repos", json.dumps({"path": widgets}))
        self.fake.add_issue("acme/widgets", 5, title="Map: five", labels=["wayfinder:map"])
        self.fake.add_issue("acme/widgets", 6, title="Map: six", labels=["wayfinder:map"])
        body = "## Destination\n\nx\n\n<!-- kipo:meta {\"mapIssue\": 6} -->"
        self.fake.add_issue("acme/widgets", 7, title="Effort on six", body=body, labels=["kipo:effort"])
        self.fake.add_issue("acme/gadgets", 9, title="Map: gadgets", labels=["wayfinder:map"])
        out = self.app.dispatch("GET", "/tree", "")[1]
        self.assertEqual([r["slug"] for r in out["repos"]], ["acme/widgets"])
        items = {(i["kind"], i["number"]): i for i in out["repos"][0]["items"]}
        self.assertEqual(set(items), {("map", 5), ("effort", 7)})  # map 6 is effort 7
        self.assertEqual((items[("map", 5)]["onSidebar"], items[("effort", 7)]["onSidebar"]), (False, True))
        self.assertEqual([(a["slug"], a["maps"]) for a in out["available"]], [("acme/gadgets", 1)])

    def test_the_tree_shows_each_maps_progress(self):
        self.app.dispatch("POST", "/repos", json.dumps({"path": os.path.join(self.root, "widgets")}))
        body = "## Not yet specified\n- later\n"
        self.fake.add_issue("acme/widgets", 5, title="Map: five", body=body, labels=["wayfinder:map"])
        self.fake.add_issue("acme/widgets", 6, title="Decided", labels=["wayfinder:grilling"], state="CLOSED")
        self.fake.add_issue("acme/widgets", 7, title="Open question", labels=["wayfinder:grilling"])
        self.fake.add_issue("acme/widgets", 8, title="Build it", labels=["wayfinder:task", "ready-for-agent"])
        self.fake.sub_issues[("acme/widgets", 5)] = [6, 7, 8]
        self.fake.add_issue("acme/widgets", 9, title="Map: empty", labels=["wayfinder:map"])
        items = {i["number"]: i for i in self.app.dispatch("GET", "/tree", "")[1]["repos"][0]["items"]}
        p = items[5]["progress"]
        self.assertEqual((p["counts"]["done"], p["counts"]["you"], p["counts"]["afk"], p["fog"]), (1, 1, 1, 1))
        self.assertEqual((p["lanes"]["decide"]["done"], p["lanes"]["deliver"]["afk"]), (1, 1))
        self.assertEqual(sum(items[9]["progress"]["counts"].values()), 0)

    def test_completed_maps_and_efforts_show_only_when_asked(self):
        self.app.dispatch("POST", "/repos", json.dumps({"path": os.path.join(self.root, "widgets")}))
        self.fake.add_issue("acme/widgets", 5, title="Map: open", labels=["wayfinder:map"])
        self.fake.add_issue("acme/widgets", 6, title="Map: closed", labels=["wayfinder:map"], state="CLOSED")
        self.fake.add_issue("acme/widgets", 7, title="Effort: closed", labels=["kipo:effort"], state="CLOSED")
        nums = lambda q: {(i["number"], i["closed"]) for i in self.app.dispatch("GET", "/tree" + q, "")[1]["repos"][0]["items"]}
        self.assertEqual(nums(""), {(5, False)})
        self.assertEqual(nums("?completed=1"), {(5, False), (6, True), (7, True)})

    def test_all_done_counts_as_completed_even_while_its_issue_is_open(self):
        self.app.dispatch("POST", "/repos", json.dumps({"path": os.path.join(self.root, "widgets")}))
        self.fake.add_issue("acme/widgets", 7, title="Effort: all done", labels=["kipo:effort"])
        self.fake.add_issue("acme/widgets", 8, title="Effort: busy", labels=["kipo:effort"])
        zero = {"done": 0, "review": 0, "building": 0, "you": 0, "afk": 0, "blocked": 0}
        self.storage.save_frontier("acme/widgets", 7, {"counts": {**zero, "done": 4}, "lanes": {}, "fog": 0})
        self.storage.save_frontier("acme/widgets", 8, {"counts": {**zero, "done": 1, "you": 1}, "lanes": {}, "fog": 0})
        items = lambda q: {i["number"]: i for i in self.app.dispatch("GET", "/tree" + q, "")[1]["repos"][0]["items"]}
        self.assertEqual(sorted(items("")), [8])
        shown = items("?completed=1")
        self.assertEqual((shown[7]["allDone"], shown[7]["closed"], shown[8]["allDone"]), (True, False, False))

    def test_a_github_refusal_serves_the_last_known_listing(self):
        # Rate-limited GitHub must not make the sidebar's maps vanish: the
        # repo's last successful listing is served, and the error says so.
        self.app.dispatch("POST", "/repos", json.dumps({"path": os.path.join(self.root, "widgets")}))
        self.fake.add_issue("acme/widgets", 5, title="Map: five", labels=["wayfinder:map"])
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200, out)
        self.assertEqual([i["number"] for i in out["initiatives"]], [5])
        self.assertNotIn("errors", out)
        self.app.initiatives._gh_cache.clear()  # as if the short TTL expired
        self.fake.list_error = True
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(status, 200, out)
        self.assertEqual([i["number"] for i in out["initiatives"]], [5])
        self.assertEqual(out["errors"][0]["repo"], "acme/widgets")
        # Back to life: the fresh listing replaces the cached one.
        self.fake.list_error = False
        self.fake.add_issue("acme/widgets", 6, title="Map: six", labels=["wayfinder:map"])
        self.app.initiatives._gh_cache.clear()  # as if the short TTL expired
        status, out = self.app.dispatch("GET", "/initiatives", "")
        self.assertEqual(sorted(i["number"] for i in out["initiatives"]), [5, 6])
        self.assertNotIn("errors", out)

    def test_the_green_dot_puts_things_on_and_off_the_sidebar(self):
        self.app.dispatch("POST", "/repos", json.dumps({"path": os.path.join(self.root, "widgets")}))
        self.fake.add_issue("acme/widgets", 5, title="Map: five", labels=["wayfinder:map"])
        self.fake.add_issue("acme/widgets", 7, title="Effort", labels=["kipo:effort"])
        flip = lambda kind, n, on: self.app.dispatch("POST", "/sidebar", json.dumps({"repo": "acme/widgets", "number": n, "kind": kind, "on": on}))
        self.assertEqual(flip("map", 5, True)[0], 200)
        self.assertEqual(flip("effort", 7, False)[0], 200)
        listed = {i["number"] for i in self.app.dispatch("GET", "/initiatives", "")[1]["initiatives"]}
        self.assertEqual(listed, {5})
        flip("map", 5, False)
        flip("effort", 7, True)
        listed = {i["number"] for i in self.app.dispatch("GET", "/initiatives", "")[1]["initiatives"]}
        self.assertEqual(listed, {7})
        self.assertEqual(self.fake.issues[("acme/widgets", 7)]["state"], "OPEN")

    def test_the_sidebar_refuses_a_repo_kipo_doesnt_watch(self):
        status, out = self.app.dispatch("POST", "/sidebar", json.dumps({"repo": "acme/elsewhere", "number": 1, "kind": "map", "on": True}))
        self.assertEqual((status, out["code"]), (404, "unknown_repo"))

    def test_add_by_folder_derives_slug_and_marks_configured(self):
        path = os.path.join(self.root, "widgets")
        status, out = self.app.dispatch("POST", "/repos", f'{{"path": "{path}"}}')
        self.assertEqual(status, 200, out)
        self.assertEqual(out["repos"], [{"slug": "acme/widgets", "path": path}])
        again = self.app.dispatch("POST", "/repos", f'{{"path": "{path}"}}')[1]
        self.assertEqual(len(again["repos"]), 1)
        listed = {r["name"]: r for r in self.app.dispatch("GET", "/repos/discover", "")[1]["repos"]}
        self.assertTrue(listed["widgets"]["configured"])
        status, out = self.app.dispatch("POST", "/repos/remove", '{"slug": "acme/widgets"}')
        self.assertEqual(out["repos"], [])

    def test_add_refuses_folders_without_a_github_remote(self):
        status, out = self.app.dispatch("POST", "/repos", f'{{"path": "{os.path.join(self.root, "local-only")}"}}')
        self.assertEqual((status, out["code"]), (400, "no_github_remote"))
        status, out = self.app.dispatch("POST", "/repos", f'{{"path": "{os.path.join(self.root, "plain-folder")}"}}')
        self.assertEqual((status, out["code"]), (400, "not_a_checkout"))

    def test_start_from_folder_and_description(self):
        path = os.path.join(self.root, "widgets")
        self.app.gh.runner.git_checkouts.add(path)
        description = "Let people export a board as CSV. It should keep the column order."
        status, out = self.app.dispatch(
            "POST", "/initiatives",
            json.dumps({"path": path, "description": description, "start": "small", "worktree": True}),
        )
        self.assertEqual(status, 200, out)
        self.assertEqual(out["title"], "Let people export a board as CSV")
        self.assertEqual((out["repo"], out["start"], out["column"]), ("acme/widgets", "small", "grill"))
        self.assertEqual(self.storage.repo_path("acme/widgets"), path)
        detail = self.app.dispatch("GET", f"/initiatives/acme/widgets/{out['number']}", "")[1]
        self.assertEqual(detail["repoPath"], f"{path}-kipo{out['number']}")
        self.assertIn(["git", "-C", path, "worktree", "add", "-b", f"kipo/{out['number']}", f"{path}-kipo{out['number']}"],
                      self.app.gh.runner.calls)

    def test_remove_closes_as_not_planned_and_leaves_the_board(self):
        path = os.path.join(self.root, "widgets")
        self.app.gh.runner.git_checkouts.add(path)
        n = self.app.dispatch("POST", "/initiatives", json.dumps({"path": path, "description": "Try it"}))[1]["number"]
        self.assertEqual(len(self.app.dispatch("GET", "/initiatives", "")[1]["initiatives"]), 1)
        status, out = self.app.dispatch("POST", f"/initiatives/acme/widgets/{n}/remove", "")
        self.assertEqual((status, out["removed"]), (200, True))
        close = next(c for c in self.app.gh.runner.calls if c[1:3] == ["issue", "close"])
        self.assertIn("not planned", close)
        self.assertEqual(self.app.dispatch("GET", "/initiatives", "")[1]["initiatives"], [])

    def test_lists_every_session_started(self):
        self.storage.record_session("acme/widgets", 1, "intake", "lp-a")
        self.storage.record_session("acme/widgets", 1, "build-t4", "lp-b")
        self.storage.record_session("acme/gadgets", 2, "intake", "lp-c")
        status, out = self.app.dispatch("GET", "/sessions", "")
        self.assertEqual((status, sorted(out["sessions"])), (200, ["lp-a", "lp-b", "lp-c"]))
        # Each session with the repo it works in, so the UI can file it in that repo's subfolder.
        self.assertEqual(
            sorted((s["slot"], s["repo"]) for s in out["byRepo"]),
            [("lp-a", "acme/widgets"), ("lp-b", "acme/widgets"), ("lp-c", "acme/gadgets")],
        )

    def test_start_requires_a_description(self):
        path = os.path.join(self.root, "widgets")
        status, out = self.app.dispatch("POST", "/initiatives", json.dumps({"path": path, "description": " "}))
        self.assertEqual((status, out["code"]), (400, "invalid_request"))

    def test_title_from_long_description(self):
        title = ini.title_from("Build a multi-tenant billing platform " * 5)
        self.assertLessEqual(len(title), ini.TITLE_MAX + 1)
        self.assertTrue(title.endswith("…"))

    def test_browse_marks_repos_and_stays_in_home(self):
        status, out = self.app.dispatch("GET", f"/browse?path={self.root}", "")
        self.assertEqual(status, 200, out)
        folders = {f["name"]: f for f in out["folders"]}
        self.assertTrue(folders["widgets"]["repo"])
        self.assertFalse(folders["plain-folder"]["repo"])
        self.assertEqual(out["parent"], os.path.realpath(self.home))
        status, out = self.app.dispatch("GET", "/browse?path=/etc", "")
        self.assertEqual((status, out["code"]), (400, "outside_home"))


if __name__ == "__main__":
    unittest.main()
