"""A fake ``gh``/``git`` runner that emulates just enough of the CLI in memory."""
import json
import os
import re
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _flag_values(args, flag):
    return [args[i + 1] for i, a in enumerate(args) if a == flag and i + 1 < len(args)]


def _flag(args, flag, default=None):
    values = _flag_values(args, flag)
    return values[-1] if values else default


class FakeGh:
    def __init__(self, git_checkouts=()):
        self.issues = {}  # (repo, number) -> issue dict
        self.labels = set()  # (repo, name)
        self.calls = []
        self.git_checkouts = set(git_checkouts)
        self.graphql_response = None
        self.graphql_error = None
        self.next_number = 1
        self.blobs = {}  # "origin/<ref>:<path>" -> text, for git show
        self.prs = {}  # (repo, number) -> pr dict
        self.blocked_by = {}  # (repo, number) -> [blocker numbers]
        self.sub_issues = {}  # (repo, map number) -> [child numbers]
        self.issue_queries = 0
        self._lock = threading.Lock()

    def add_pr(self, repo, number, title="PR", body="", state="OPEN", head="feature", draft=False):
        self.prs[(repo, number)] = {
            "number": number, "title": title, "url": f"https://github.com/{repo}/pull/{number}",
            "state": state, "isDraft": draft, "headRefName": head, "body": body,
        }

    def add_issue(self, repo, number, title="T", body="", labels=(), state="OPEN", assignees=0):
        self.issues[(repo, number)] = {
            "number": number,
            "title": title,
            "url": f"https://github.com/{repo}/issues/{number}",
            "labels": [{"name": l} for l in labels],
            "body": body,
            "updatedAt": "2026-11-06T00:00:00Z",
            "state": state,
            "assignees": assignees,
            "comments": [],
        }
        self.next_number = max(self.next_number, number + 1)

    def label_set(self, repo, number):
        return {l["name"] for l in self.issues[(repo, number)]["labels"]}

    def __call__(self, args, input_text=None, timeout=None):
        # The backend edits ticket labels in parallel; one call at a time here.
        with self._lock:
            return self._call(args, input_text)

    def _call(self, args, input_text=None):
        self.calls.append(list(args))
        if args[0] == "git":
            path = args[2]
            if args[3:5] == ["worktree", "add"]:
                if path not in self.git_checkouts:
                    return 128, "", "not a git repository"
                self.git_checkouts.add(args[-1])
                return 0, "", ""
            if args[3:4] == ["show"]:
                text = self.blobs.get(args[4])
                return (0, text, "") if text is not None else (128, "", f"fatal: invalid object name '{args[4]}'")
            return (0, "true\n", "") if path in self.git_checkouts else (128, "", "not a git repository")
        cmd = args[1:3]
        repo = _flag(args, "-R")
        if cmd == ["label", "create"]:
            self.labels.add((repo, args[3]))
            return 0, "", ""
        if cmd == ["issue", "view"]:
            issue = self.issues.get((repo, int(args[3])))
            if not issue:
                return 1, "", "GraphQL: Could not resolve to an issue"
            return 0, json.dumps(issue), ""
        if cmd == ["issue", "list"]:
            label = _flag(args, "--label")
            state = _flag(args, "--state", "open").upper()
            out = [
                i for (r, _), i in self.issues.items()
                if r == repo and i["state"] == state and label in {l["name"] for l in i["labels"]}
            ]
            return 0, json.dumps(out), ""
        if cmd == ["issue", "create"]:
            for name in _flag_values(args, "--label"):
                if (repo, name) not in self.labels:
                    return 1, "", f"could not add label: '{name}' not found"
            n = self.next_number
            self.add_issue(repo, n, title=_flag(args, "--title"), body=input_text, labels=_flag_values(args, "--label"))
            return 0, f"https://github.com/{repo}/issues/{n}\n", ""
        if cmd == ["issue", "edit"]:
            issue = self.issues[(repo, int(args[3]))]
            if "--body-file" in args:
                issue["body"] = input_text
            names = [l["name"] for l in issue["labels"]]
            for name in _flag_values(args, "--add-label"):
                if (repo, name) not in self.labels:
                    return 1, "", f"'{name}' not found"
                if name not in names:
                    names.append(name)
            remove = set(_flag_values(args, "--remove-label"))
            issue["labels"] = [{"name": n} for n in names if n not in remove]
            return 0, issue["url"] + "\n", ""
        if cmd == ["issue", "close"]:
            self.issues[(repo, int(args[3]))]["state"] = "CLOSED"
            return 0, "", ""
        if cmd == ["pr", "list"]:
            fields = _flag(args, "--json").split(",")
            out = [{k: p.get(k) for k in fields} for (r, _), p in sorted(self.prs.items()) if r == repo]
            return 0, json.dumps(out), ""
        if cmd == ["pr", "view"]:
            pr = self.prs.get((repo, int(args[3])))
            if not pr:
                return 1, "", "GraphQL: Could not resolve to a PullRequest"
            return 0, json.dumps(pr), ""
        if cmd == ["api", "graphql"]:
            query = next(a for a in args if a.startswith("query="))
            if self.graphql_error and "blockedBy" in query:
                return 1, "", self.graphql_error
            variables = dict(v.split("=", 1) for v in _flag_values(args, "-f") + _flag_values(args, "-F") if not v.startswith("query="))
            repo = f"{variables.get('owner')}/{variables.get('name')}"
            if " issues(" in query:
                return 0, json.dumps(self._issues_query(repo, query)), ""
            if "subIssues" in query and self.graphql_response is None:
                return 0, json.dumps(self._sub_issues_query(repo, int(variables["number"]))), ""
            return 0, json.dumps(self.graphql_response), ""
        return 1, "", f"fake gh does not support {args}"

    # -- graphql emulation ---------------------------------------------

    def _node(self, repo, issue, blocked=True):
        node = {
            "number": issue["number"], "title": issue["title"], "url": issue["url"], "state": issue["state"],
            "labels": {"nodes": [{"name": l["name"]} for l in issue["labels"]]},
        }
        if blocked:
            node["blockedBy"] = {"nodes": [
                {"number": b, "state": self.issues[(repo, b)]["state"]} for b in self.blocked_by.get((repo, issue["number"]), ())
            ]}
        return node

    def _issues_query(self, repo, query):
        self.issue_queries += 1
        wanted = set(json.loads(re.search(r"labels: (\[[^\]]*\])", query).group(1)))
        nodes = [
            self._node(repo, i, blocked="blockedBy" in query)
            for (r, _), i in sorted(self.issues.items())
            if r == repo and wanted & {l["name"] for l in i["labels"]}
        ]
        return {"data": {"repository": {"issues": {"pageInfo": {"hasNextPage": False, "endCursor": None}, "nodes": nodes}}}}

    def _sub_issues_query(self, repo, number):
        nodes = []
        for c in self.sub_issues.get((repo, number), ()):
            issue = self.issues[(repo, c)]
            n = self._node(repo, issue, blocked=True)
            n["assignees"] = {"totalCount": issue.get("assignees") or 0}
            nodes.append(n)
        body = (self.issues.get((repo, number)) or {}).get("body") or ""
        return {"data": {"repository": {"issue": {"body": body, "subIssues": {"nodes": nodes}}}}}
