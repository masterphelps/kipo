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

    def test_opening_a_map_adds_its_repo_from_this_mac(self):
        self.fake.add_issue("acme/gadgets", 9, title="Map: gadgets", labels=["wayfinder:map"])
        listed = self.app.dispatch("GET", "/maps", "")[1]["maps"]
        self.assertEqual([(m["repo"], m["repoAdded"], m["opened"]) for m in listed], [("acme/gadgets", False, False)])
        status, out = self.app.dispatch("POST", "/maps/open", json.dumps({"maps": [{"repo": "acme/gadgets", "number": 9}]}))
        self.assertEqual((status, out["errors"]), (200, []), out)
        self.assertEqual([r["slug"] for r in self.storage.get_config()["repos"]], ["acme/gadgets"])
        self.assertTrue(self.app.dispatch("GET", "/maps", "")[1]["maps"][0]["opened"])

    def test_a_map_in_a_repo_not_on_this_mac_is_refused_by_name(self):
        status, out = self.app.dispatch("POST", "/maps/open", json.dumps({"maps": [{"repo": "acme/elsewhere", "number": 3}]}))
        self.assertEqual(status, 200, out)
        self.assertIn("isn't checked out on this Mac", out["errors"][0]["error"])

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
