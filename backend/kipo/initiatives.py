"""Efforts: the issue body format, columns and paths, advance, sessions, tickets, PRs and frontier.

An effort is a GitHub issue labelled ``kipo:effort``; its column is its
``kipo:col:<id>`` label and its path lives in the ``kipo:meta`` comment.

A wayfinder map (``wayfinder:map``) you open in KiPo is an effort too, as it
stands: its Destination is the map's own, its tickets are the map's children,
and KiPo never writes to it. A map an effort already points at is that effort.
"""
import datetime
import json
import os
import re

from . import COLUMNS, DEFAULT_START, PATHS, SKILLS, STARTS, KipoError, run_line
from . import docs
from . import frontier as frontier_mod
from . import state as col_state

EFFORT_LABEL = "kipo:effort"
MAP_LABEL = "wayfinder:map"
MAP_START = "huge"  # a map is Decide work: shape, then plan, build, review
COL_PREFIX = "kipo:col:"
START_PREFIX = "kipo:start:"
META_KEYS = ("repoPath", "start", "path", "mapIssue", "specPath", "sourceIssue")

_META_RE = re.compile(r"^<!--\s*kipo:meta\s+(.*?)\s*-->\s*$")
_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
_ARTIFACT_RE = re.compile(r"^- \[((?:\\.|[^\]\\])*)\]\((<[^>]*>|.*)\)\s*$")
_SLUG_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def today():
    return datetime.date.today().isoformat()


# -- body ---------------------------------------------------------------

def default_meta():
    return {key: None for key in META_KEYS}


def _escape_label(label):
    return label.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def _unescape_label(label):
    return re.sub(r"\\(.)", r"\1", label)


def _render_href(href):
    return f"<{href}>" if re.search(r"[\s()<>]", href) else href


def render_body(body):
    """Render ``{destination, request, artifacts, phaseLog, meta}`` as the issue body."""
    meta = {**default_meta(), **(body.get("meta") or {})}
    lines = ["## Destination", "", body.get("destination", "").strip(), ""]
    if (body.get("request") or "").strip():
        lines += ["## Original request", "", body["request"].strip(), ""]
    lines += ["## Artifacts", ""]
    for a in body.get("artifacts") or []:
        lines.append(f"- [{_escape_label(a['label'])}]({_render_href(a['href'])})")
    if body.get("artifacts"):
        lines.append("")
    lines += ["## Phase log", ""]
    for entry in body.get("phaseLog") or []:
        lines.append(f"- {entry}")
    if body.get("phaseLog"):
        lines.append("")
    meta_json = json.dumps(meta, separators=(",", ":"), ensure_ascii=False).replace(">", "\\u003e")
    lines.append(f"<!-- kipo:meta {meta_json} -->")
    return "\n".join(lines)


def parse_body(text):
    """Parse an issue body; tolerant of missing sections and a missing meta line."""
    meta = default_meta()
    sections = {}
    current = None
    for raw in (text or "").replace("\r\n", "\n").split("\n"):
        m = _META_RE.match(raw.strip())
        if m:
            try:
                parsed = json.loads(m.group(1))
            except ValueError:
                parsed = None
            if isinstance(parsed, dict):
                meta = {**default_meta(), **parsed}
            continue
        h = _HEADING_RE.match(raw)
        if h:
            current = h.group(1).strip().lower()
            sections.setdefault(current, [])
            continue
        if current is not None:
            sections[current].append(raw)

    artifacts = []
    for line in sections.get("artifacts", []):
        m = _ARTIFACT_RE.match(line.strip())
        if m:
            href = m.group(2)
            if href.startswith("<") and href.endswith(">"):
                href = href[1:-1]
            artifacts.append({"label": _unescape_label(m.group(1)), "href": href})

    phase_log = [line.strip()[2:].strip() for line in sections.get("phase log", []) if line.strip().startswith("- ")]

    parsed = {
        "destination": "\n".join(sections.get("destination", [])).strip(),
        "artifacts": artifacts,
        "phaseLog": phase_log,
        "meta": meta,
    }
    request = "\n".join(sections.get("original request", [])).strip()
    if request:
        parsed["request"] = request
    return parsed


def is_map(issue):
    """A wayfinder map KiPo didn't make: an effort in its own right."""
    labels = label_names(issue)
    return MAP_LABEL in labels and EFFORT_LABEL not in labels


def map_body(issue):
    """A map read as an effort body: its own Destination, itself as the map."""
    parsed = parse_body(issue.get("body"))
    return {
        "destination": parsed["destination"],
        "artifacts": [],
        "phaseLog": [],
        "meta": {**default_meta(), "start": MAP_START, "mapIssue": issue["number"]},
    }


def merge_artifacts(*lists):
    """Concatenate artifact lists, keeping the first entry for each href."""
    seen, merged = set(), []
    for items in lists:
        for a in items or []:
            if a["href"] not in seen:
                seen.add(a["href"])
                merged.append(a)
    return merged


# -- labels, columns and paths -------------------------------------------

def label_names(issue):
    return [l["name"] if isinstance(l, dict) else str(l) for l in issue.get("labels") or []]


def _label_values(labels, prefix):
    return [l[len(prefix):] for l in labels if l.startswith(prefix)]


def start_from(meta, labels):
    if meta.get("start") in STARTS:
        return meta["start"]
    for value in _label_values(labels, START_PREFIX):
        if value in STARTS:
            return value
    return DEFAULT_START


def path_from(meta, start):
    """The effort's path: the meta's when it is a valid, ordered column list, else its start's."""
    path = meta.get("path")
    if (
        isinstance(path, list) and path
        and all(c in COLUMNS for c in path)
        and len(set(path)) == len(path)
        and [COLUMNS.index(c) for c in path] == sorted(COLUMNS.index(c) for c in path)
    ):
        return list(path)
    return list(PATHS[start])


def column_from(labels, path):
    """The current column: the furthest ``kipo:col:`` label present, else the path's first."""
    found = [v for v in _label_values(labels, COL_PREFIX) if v in COLUMNS]
    if not found:
        return path[0]
    return max(found, key=COLUMNS.index)


def next_on_path(column, path):
    """The first column on ``path`` after ``column``, or None."""
    i = COLUMNS.index(column)
    return next((c for c in path if COLUMNS.index(c) > i), None)


def rewrite_path(path, column, to):
    """The path after jumping from ``column`` to the later column ``to``.

    What was walked up to ``column`` stays, then ``to``, then whatever the old
    path had after ``to``.
    """
    ci, ti = COLUMNS.index(column), COLUMNS.index(to)
    walked = [c for c in path if COLUMNS.index(c) < ci] + [column]
    rest = [c for c in path if COLUMNS.index(c) > ti]
    if not rest and to != "done":
        rest = ["done"]
    return walked + [to] + rest


def position(column, path):
    """``(k, N)`` for the seed: the column's 1-based place on the path."""
    if column in path:
        return path.index(column) + 1, len(path)
    i = COLUMNS.index(column)
    return sum(1 for c in path if COLUMNS.index(c) < i) + 1, len(path)


def ticket_numbers(labels):
    """Effort numbers from ``kipo:<n>`` ticket labels."""
    return [int(v) for v in _label_values(labels, "kipo:") if v.isdigit()]


# -- PRs ----------------------------------------------------------------

_CLOSES_RE = re.compile(
    r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+"
    r"(?:(?:https://github\.com/)?([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)(?:#|/issues/))?#?(\d+)\b",
    re.IGNORECASE,
)


def closed_issues(body, repo):
    """Issue numbers in ``repo`` that a PR body closes with a closing keyword."""
    found = []
    for m in _CLOSES_RE.finditer(body or ""):
        other = m.group(1)
        if other and other.lower() != repo.lower():
            continue
        n = int(m.group(2))
        if n not in found:
            found.append(n)
    return found


def on_effort_branch(head, number):
    head = head or ""
    prefix = f"kipo/{number}"
    return head == prefix or head.startswith(prefix + "/") or head.startswith(prefix + "-")


def review_gate(prs):
    """Review passes when there is a PR and every PR is merged or closed."""
    return bool(prs) and all(p["state"] in ("MERGED", "CLOSED") for p in prs)


# -- names and seeds ----------------------------------------------------

def slugify(text):
    return re.sub(r"[^a-z0-9]", "-", text.lower())


def session_name(repo, number, key):
    owner, name = repo.split("/", 1)
    return slugify(f"kipo-{owner}-{name}-{number}-{key}")


def render_seed(effort, repo_path, column, ticket=None, skill=None, state_key=None):
    """The first message of a KiPo conversation. ``state_key`` gives a ticket's
    conversation its own state file; the effort's own conversation uses state.json."""
    n, path = effort["number"], effort["path"]
    k, total = position(column, path)
    lines = [
        f'[KiPo] Effort #{n} "{effort["title"]}" in {effort["repo"]}',
        f"Column: {column} ({k} of {total} on this path: {' → '.join(path)})",
        f"Start: {effort['start']}",
        f"Repo checkout: {repo_path}",
        f"Effort issue: {effort['url']}",
        f"State file: {col_state.session_state_path(repo_path, n, state_key) if state_key else col_state.state_path(repo_path, n)}",
    ]
    if ticket is not None:
        lines.append(f'Ticket: #{ticket["number"]} "{ticket["title"]}"')
        if ticket.get("blockers"):
            listed = ", ".join(f"#{b['number']} ({b['state'].lower()})" for b in ticket["blockers"])
            lines.append(f"Blocked by: {listed}")
    lines.append(f"Load the skill `kipo-{column}` and follow it. Destination: {effort['destination']}")
    if skill:
        lines.append(run_line(skill))
    return "\n".join(lines)


def render_plan_handoff(effort, skill=None):
    """What goes into the Grill session when the effort moves on to Plan."""
    k, total = position("plan", effort["path"])
    text = f"Moving to Plan (column {k} of {total}). Load the skill `kipo-plan` and follow it."
    if skill:
        text += "\n" + run_line(skill)
    return text


_ISSUE_URL_RE = re.compile(r"/issues/(\d+)(?:[#?].*)?$")


def source_issue_of(repo, meta, artifacts):
    """The issue an effort was started from: the meta field, or else a "Source
    issue" artifact linking an issue in the same repo. None when there isn't one."""
    if meta.get("sourceIssue"):
        return int(meta["sourceIssue"])
    for artifact in artifacts:
        if (artifact.get("label") or "").strip().lower() != "source issue":
            continue
        m = re.search(r"github\.com/([^/]+/[^/]+)/issues/(\d+)", artifact.get("href") or "")
        if m and m.group(1).lower() == repo.lower():
            return int(m.group(2))
    return None


def derive_meta(meta, artifacts):
    """Fill mapIssue and specPath from the "Wayfinder map" and "Spec" artifacts
    when the meta comment doesn't carry them yet."""
    derived = dict(meta)
    for artifact in artifacts:
        label = (artifact.get("label") or "").strip().lower()
        href = artifact.get("href") or ""
        # Agents write "Wayfinder map" or "Wayfinder map #20"; both name the map.
        if (label == "wayfinder map" or label.startswith("wayfinder map ")) and not derived.get("mapIssue"):
            m = _ISSUE_URL_RE.search(href)
            if m:
                derived["mapIssue"] = int(m.group(1))
        elif label == "spec" and not derived.get("specPath"):
            derived["specPath"] = href
    return derived


# -- validation ---------------------------------------------------------

TITLE_MAX = 72


def title_from(description):
    """A short issue title from a free-form description."""
    first = re.split(r"(?<=[.!?])\s|\n", description.strip(), maxsplit=1)[0].strip().rstrip(".")
    if len(first) <= TITLE_MAX:
        return first
    cut = first[:TITLE_MAX].rsplit(" ", 1)[0]
    return f"{cut}…"


def validate_repo_slug(repo):
    if not isinstance(repo, str) or not _SLUG_RE.match(repo):
        raise KipoError("The repo must look like owner/name.", "invalid_repo", 400)


def _issue_number(value, what="ticket", code="invalid_ticket"):
    if isinstance(value, bool) or not str(value).isdigit() or int(value) <= 0:
        raise KipoError(f"The {what} must be an issue number.", code, 400)
    return int(value)


def validate_skill(skill):
    if skill is None:
        return None
    if skill not in SKILLS:
        raise KipoError(f"{skill!r} is not one of KiPo's skills.", "unknown_skill", 400)
    return skill


def validate_column(column):
    if column not in COLUMNS:
        raise KipoError(f"{column!r} is not a KiPo column.", "invalid_column", 400)
    return column


# -- service ------------------------------------------------------------

class Initiatives:
    def __init__(self, gh, storage, clock=today):
        self.gh = gh
        self.storage = storage
        self.clock = clock

    # -- helpers ----------------------------------------------------------

    def _configured_path(self, repo):
        path = self.storage.repo_path(repo)
        if not path:
            raise KipoError(f"{repo} is not a configured repo.", "unknown_repo", 404)
        return path

    def _repo_path(self, repo, meta):
        return meta.get("repoPath") or self.storage.repo_path(repo)

    def _summary(self, repo, issue, body):
        labels = label_names(issue)
        start = start_from(body["meta"], labels)
        path = path_from(body["meta"], start)
        return {
            "repo": repo,
            "number": issue["number"],
            "title": issue["title"],
            "url": issue["url"],
            "column": column_from(labels, path),
            "start": start,
            "path": path,
            "destination": body["destination"],
            "updatedAt": issue.get("updatedAt") or "",
            "ticketCounts": None,
            "kind": "map" if is_map(issue) else "effort",
        }

    def _fetch(self, repo, number):
        validate_repo_slug(repo)
        issue = self.gh.view_issue(repo, number)
        if issue and is_map(issue):
            return issue, map_body(issue)
        if not issue or EFFORT_LABEL not in label_names(issue):
            raise KipoError(f"Issue #{number} in {repo} is not a KiPo effort or a wayfinder map.", "not_effort", 404)
        return issue, parse_body(issue.get("body"))

    # -- tickets and PRs --------------------------------------------------

    def _ticket_nodes(self, repo, number):
        """Every ``kipo:<n>`` issue, open and closed, with its native blockers.

        Returns ``(nodes, note)``; each node has a ``blockers`` list of
        ``{number, state}``.
        """
        owner, name = repo.split("/", 1)
        query = _TICKETS_QUERY.replace("LABELS", json.dumps([f"kipo:{number}"]))
        note = None
        try:
            data = self.gh.graphql(query.replace("BLOCKED", _TICKET_BLOCKED_FIELD), owner=owner, name=name)
        except KipoError as e:
            if "blockedBy" not in e.message:
                raise
            data = self.gh.graphql(query.replace("BLOCKED", ""), owner=owner, name=name)
            note = "Issue dependencies are unavailable, so blocking was not checked."
        issues = ((((data or {}).get("data") or {}).get("repository") or {}).get("issues") or {})
        nodes = []
        for node in issues.get("nodes") or []:
            blockers = (node.get("blockedBy") or {}).get("nodes") or []
            nodes.append({
                "number": node["number"],
                "title": node.get("title") or "",
                "url": node.get("url") or "",
                "state": node.get("state") or "OPEN",
                "labels": [l["name"] for l in (node.get("labels") or {}).get("nodes") or []],
                "blockers": [
                    {"number": b["number"], "state": b.get("state") or "OPEN"} for b in blockers if "number" in b
                ],
            })
        nodes.sort(key=lambda n: n["number"])
        return nodes, note

    def _map_children(self, repo, map_issue):
        """Every child of the wayfinder map, open and closed, plus the map's body
        (for the fog). Returns ``(nodes, body)``; nodes as in ``_ticket_nodes``."""
        owner, name = repo.split("/", 1)
        try:
            data = self.gh.graphql(_MAP_QUERY.replace("BLOCKED", _TICKET_BLOCKED_FIELD), owner=owner, name=name, number=map_issue)
        except KipoError as e:
            if "blockedBy" not in e.message:
                raise
            data = self.gh.graphql(_MAP_QUERY.replace("BLOCKED", ""), owner=owner, name=name, number=map_issue)
        issue = (((data or {}).get("data") or {}).get("repository") or {}).get("issue") or {}
        nodes = []
        for node in (issue.get("subIssues") or {}).get("nodes") or []:
            blockers = (node.get("blockedBy") or {}).get("nodes") or []
            nodes.append({
                "number": node["number"],
                "title": node.get("title") or "",
                "url": node.get("url") or "",
                "state": node.get("state") or "OPEN",
                "labels": [l["name"] for l in (node.get("labels") or {}).get("nodes") or []],
                "blockers": [{"number": b["number"], "state": b.get("state") or "OPEN"} for b in blockers if "number" in b],
                "assigned": bool((node.get("assignees") or {}).get("totalCount")),
            })
        return nodes, issue.get("body") or ""

    def _prs(self, repo, number, ticket_numbers_):
        """The repo's PRs that belong to this effort, each with the tickets it closes."""
        mine = set(ticket_numbers_)
        prs = []
        for pr in self.gh.list_prs(repo):
            closes = closed_issues(pr.get("body"), repo)
            tickets = [t for t in closes if t in mine]
            if not (tickets or number in closes or on_effort_branch(pr.get("headRefName"), number)):
                continue
            prs.append({
                "number": pr["number"],
                "title": pr.get("title") or "",
                "url": pr.get("url") or "",
                "state": (pr.get("state") or "OPEN").upper(),
                "isDraft": bool(pr.get("isDraft")),
                "headRefName": pr.get("headRefName") or "",
                "tickets": tickets,
            })
        prs.sort(key=lambda p: p["number"])
        return prs

    @staticmethod
    def _ticket_detail(node, prs, sessions):
        key = f"build-t{node['number']}"
        return {
            "number": node["number"],
            "title": node["title"],
            "url": node["url"],
            "state": node["state"],
            "blockedBy": [b["number"] for b in node["blockers"] if b["state"] == "OPEN"],
            "sessionKey": key if key in sessions or node["state"] == "OPEN" else None,
            "prs": [p["number"] for p in prs if node["number"] in p["tickets"]],
        }

    # -- detail -----------------------------------------------------------

    def _detail(self, repo, issue, body):
        summary = self._summary(repo, issue, body)
        number = issue["number"]
        column = summary["column"]
        meta = body["meta"]
        repo_path = self._repo_path(repo, meta)
        st = col_state.read_state(repo_path, number)
        artifacts = merge_artifacts(body["artifacts"], col_state.state_artifacts(st))
        meta = derive_meta(meta, artifacts)
        sessions = self.storage.get_sessions(repo, number)
        # Each ticket conversation's own state: its skills, decisions and documents.
        session_states = {}
        for key in sessions:
            if key not in COLUMNS:
                ss = col_state.read_session_state(repo_path, number, key)
                if ss:
                    session_states[key] = ss
                    artifacts = merge_artifacts(artifacts, col_state.state_artifacts(ss))

        st, session_states = col_state.route_ticket_decisions(st, session_states, sessions)

        nodes, tickets_note, tickets_error = [], None, None
        try:
            nodes, tickets_note = self._ticket_nodes(repo, number)
        except KipoError as e:
            tickets_error = e.message
        prs, prs_error = [], None
        try:
            # A PR that closes the issue the effort started from is the effort's PR too.
            source = source_issue_of(repo, meta, artifacts)
            prs = self._prs(repo, number, [n["number"] for n in nodes] + ([source] if source else []))
        except KipoError as e:
            prs_error = e.message
        tickets = [self._ticket_detail(n, prs, sessions) for n in nodes]

        # The frontier: build tickets and the map's children, each in its real state.
        map_nodes, map_body = [], None
        if meta.get("mapIssue"):
            try:
                map_nodes, map_body = self._map_children(repo, int(meta["mapIssue"]))
            except KipoError:
                map_nodes, map_body = [], None
        source_node = None
        source = source_issue_of(repo, meta, artifacts)
        if source and source not in {n["number"] for n in nodes} | {n["number"] for n in map_nodes}:
            try:
                found = self.gh.view_issue(repo, source)
            except KipoError:
                found = None
            if found:
                source_node = {
                    "number": source, "title": found.get("title") or "", "url": found.get("url") or "",
                    "state": (found.get("state") or "OPEN").upper(), "labels": label_names(found), "blockers": [],
                }
        front = frontier_mod.build(nodes, map_nodes, prs, sessions, map_body, source_node)
        front.update(frontier_mod.stage_of(front, column, prs))
        self.storage.save_frontier(repo, number, {
            "counts": front["counts"], "lanes": front["lanes"], "fog": front["fog"],
            "stage": front["stage"], "active": front["active"],
        })
        summary["ticketCounts"] = {
            "open": sum(1 for t in tickets if t["state"] == "OPEN"),
            "closed": sum(1 for t in tickets if t["state"] != "OPEN"),
        } if tickets else None

        gate = review_gate(prs) if column == "review" else col_state.gate_passed(st)
        detail = {
            **summary,
            "repoPath": repo_path or "",
            "mapIssue": meta.get("mapIssue"),
            "specPath": meta.get("specPath"),
            "sourceIssue": meta.get("sourceIssue"),
            "artifacts": artifacts,
            "phaseLog": body["phaseLog"],
            "state": st,
            "gatePassed": gate,
            "sessions": sessions,
            # What each earlier column recorded, for the column buttons in the page.
            "history": col_state.read_archived(repo_path, number, COLUMNS[: COLUMNS.index(column)]),
            "tickets": tickets,
            "prs": prs,
            "frontier": front,
            "sessionStates": session_states,
        }
        if tickets_note:
            detail["ticketsNote"] = tickets_note
        if tickets_error:
            detail["ticketsError"] = tickets_error
        if prs_error:
            detail["prsError"] = prs_error
        return detail

    # -- list -------------------------------------------------------------

    def list(self):
        efforts, errors = [], []
        for entry in self.storage.get_config()["repos"]:
            repo = entry.get("slug")
            try:
                hidden = self.storage.hidden(repo)
                found, wrapped = [], set()
                for issue in self.gh.list_issues(repo, EFFORT_LABEL):
                    body = parse_body(issue.get("body"))
                    wrapped.add(self._map_of(repo, issue["number"], body))
                    if issue["number"] not in hidden:
                        found.append(self._summary(repo, issue, body))
                # The maps you opened, unless an effort already points at them.
                opened = self.storage.opened_maps(repo) - wrapped - hidden
                if opened:
                    for issue in self.gh.list_issues(repo, MAP_LABEL):
                        if is_map(issue) and issue["number"] in opened:
                            found.append(self._summary(repo, issue, map_body(issue)))
            except KipoError as e:
                errors.append({"repo": repo, "error": e.message, "code": e.code})
                continue
            if found:
                try:
                    counts = self._ticket_counts(repo, [i["number"] for i in found])
                except KipoError as e:
                    counts = {}
                    errors.append({"repo": repo, "error": e.message, "code": e.code})
                for i in found:
                    i["ticketCounts"] = counts.get(i["number"])
                    i["frontier"] = self.storage.get_frontier(repo, i["number"])
                    # The stage, read from the last frontier seen, else from the column.
                    i["stage"] = (i["frontier"] or {}).get("stage") or frontier_mod.LEGACY_STAGE.get(i["column"], "intake")
            efforts += found
        efforts.sort(key=lambda i: i["updatedAt"], reverse=True)
        result = {"initiatives": efforts}
        if errors:
            result["errors"] = errors
        return result

    def wrapped_maps(self, repo):
        """``{map number: effort number}`` for the efforts in a repo that point at a map."""
        out = {}
        for issue in self.gh.list_issues(repo, EFFORT_LABEL):
            m = self._map_of(repo, issue["number"], parse_body(issue.get("body")))
            if m:
                out[m] = issue["number"]
        return out

    def hide(self, repo, number):
        """Take an effort off the sidebar. A map is simply closed in KiPo; an
        effort KiPo made is hidden and can be restored. GitHub isn't touched."""
        validate_repo_slug(repo)
        if number in self.storage.opened_maps(repo):
            self.storage.close_map(repo, number)
        else:
            self.storage.hide(repo, number)
        return {"hidden": True, "repo": repo, "number": number}

    def unhide(self, repo, number):
        validate_repo_slug(repo)
        self.storage.unhide(repo, number)
        return {"hidden": False, "repo": repo, "number": number}

    def _map_of(self, repo, number, body):
        """The map an effort points at: its meta, else its artifacts or state file."""
        meta = body["meta"]
        if meta.get("mapIssue"):
            return int(meta["mapIssue"])
        path = self._repo_path(repo, meta)
        artifacts = merge_artifacts(body["artifacts"], col_state.state_artifacts(col_state.read_state(path, number)) if path else [])
        found = derive_meta(meta, artifacts).get("mapIssue")
        return int(found) if found else None

    TICKET_COUNT_PAGES = 5

    def _ticket_counts(self, repo, numbers):
        """``{effort number: {open, closed}}`` from one (paged) query over the repo.

        GitHub's ``labels`` filter matches any of the labels, so one query finds
        every ticket of every listed effort.
        """
        owner, name = repo.split("/", 1)
        wanted = set(numbers)
        query = _COUNT_QUERY.replace("LABELS", json.dumps([f"kipo:{n}" for n in sorted(wanted)]))
        counts, cursor = {}, None
        for _ in range(self.TICKET_COUNT_PAGES):
            variables = {"owner": owner, "name": name}
            if cursor:
                variables["cursor"] = cursor
            data = self.gh.graphql(query, **variables)
            issues = ((((data or {}).get("data") or {}).get("repository") or {}).get("issues") or {})
            for node in issues.get("nodes") or []:
                labels = [l["name"] for l in (node.get("labels") or {}).get("nodes") or []]
                key = "open" if (node.get("state") or "OPEN") == "OPEN" else "closed"
                for n in ticket_numbers(labels):
                    if n in wanted:
                        per = counts.setdefault(n, {"open": 0, "closed": 0})
                        per[key] += 1
            page = issues.get("pageInfo") or {}
            if not page.get("hasNextPage") or not page.get("endCursor"):
                break
            cursor = page["endCursor"]
        return counts

    # -- create -----------------------------------------------------------

    def create(self, repo, title, destination, start=None, worktree=False, source_issue=None):
        validate_repo_slug(repo)
        if not isinstance(destination, str) or not destination.strip():
            raise KipoError("Say what you want to do first.", "invalid_request", 400)
        if not isinstance(title, str) or not title.strip():
            title = title_from(destination)
        start = start or DEFAULT_START
        if start not in STARTS:
            raise KipoError(f"{start!r} is not a KiPo start point.", "invalid_start", 400)
        if source_issue is not None:
            source_issue = _issue_number(source_issue, "source issue", "invalid_request")
        repo_path = self._configured_path(repo)
        path = list(PATHS[start])
        first = path[0]
        body = {
            "destination": destination.strip(),
            # The human's own words stay here while the Destination gets sharpened.
            "request": destination.strip(),
            "artifacts": [],
            "phaseLog": [f"{self.clock()} created in {first}"],
            "meta": {
                **default_meta(), "repoPath": repo_path, "start": start, "path": path,
                "sourceIssue": source_issue,
            },
        }
        labels = [EFFORT_LABEL, f"{COL_PREFIX}{first}", f"{START_PREFIX}{start}"]
        for label in labels:
            self.gh.ensure_label(repo, label)
        number = self.gh.create_issue(repo, title.strip(), render_body(body), labels)
        if worktree:
            # The issue number names the worktree, so it is made after the issue.
            wt_path = f"{repo_path.rstrip(os.sep)}-kipo{number}"
            self.gh.add_worktree(repo_path, wt_path, f"kipo/{number}")
            body["meta"]["repoPath"] = wt_path
            body["phaseLog"].append(f"{self.clock()} worktree {wt_path} on branch kipo/{number}")
            self.gh.edit_issue(repo, number, body=render_body(body))
        issue, parsed = self._fetch(repo, number)
        return self._summary(repo, issue, parsed)

    def detail(self, repo, number):
        issue, body = self._fetch(repo, number)
        return self._detail(repo, issue, body)

    # -- advance ----------------------------------------------------------

    def advance(self, repo, number, force=False, to=None):
        issue, body = self._fetch(repo, number)
        if is_map(issue):
            raise KipoError(
                "KiPo doesn't move a wayfinder map: it's done when its last ticket closes.", "map_not_moved", 409
            )
        if (issue.get("state") or "OPEN").upper() != "OPEN":
            raise KipoError(f"Issue #{number} is closed.", "effort_closed", 409)
        labels = label_names(issue)
        meta = body["meta"]
        start = start_from(meta, labels)
        path = path_from(meta, start)
        column = column_from(labels, path)
        repo_path = self._repo_path(repo, meta)
        st = col_state.read_state(repo_path, number)

        if to is not None:
            validate_column(to)
            if COLUMNS.index(to) <= COLUMNS.index(column):
                raise KipoError(
                    f"An effort in {column} can only move to a later column.", "invalid_column", 400
                )

        if column == "review":
            passed = review_gate(self._detail(repo, issue, body)["prs"])
            why = "Review passes once every PR is merged or closed."
        else:
            passed = col_state.gate_passed(st)
            why = f"The {column} checklist isn't finished yet."
        if not passed and not force:
            raise KipoError(f"{why} Finish it, or use Skip.", "gate_not_passed", 409)

        if to is not None:
            path = rewrite_path(path, column, to)
            target = to
        else:
            target = next_on_path(column, path)

        add, remove = [], []
        if target:
            add.append(f"{COL_PREFIX}{target}")
            remove += [l for l in labels if l.startswith(COL_PREFIX) and l != f"{COL_PREFIX}{target}"]

        meta["start"], meta["path"] = start, path
        body["artifacts"] = merge_artifacts(body["artifacts"], col_state.state_artifacts(st))
        meta.update(derive_meta(meta, body["artifacts"]))
        body["phaseLog"].append(f"{self.clock()} {column} → {target or 'closed'}")

        for label in add:
            self.gh.ensure_label(repo, label)
        self.gh.edit_issue(repo, number, body=render_body(body), add_labels=add, remove_labels=remove)
        if repo_path:
            col_state.archive_state(repo_path, number, column)
        if target is None:
            self.gh.close_issue(repo, number)

        issue, body = self._fetch(repo, number)
        return self._detail(repo, issue, body)

    def remove(self, repo, number):
        """Take an effort off the board by closing its issue as not planned.

        Nothing is deleted: the issue, its comments and any worktree stay, and
        reopening the issue on GitHub puts it back on the board.
        """
        issue, body = self._fetch(repo, number)
        if is_map(issue):
            # The map isn't KiPo's to close: only take it off the sidebar.
            self.storage.close_map(repo, number)
            return {"removed": True, "repo": repo, "number": number}
        if (issue.get("state") or "OPEN").upper() == "OPEN":
            summary = self._summary(repo, issue, body)
            self.gh.close_issue(
                repo,
                number,
                reason="not planned",
                comment=f"Removed from the KiPo board during {summary['column']}. Reopen this issue to bring it back.",
            )
        return {"removed": True, "repo": repo, "number": number}

    # -- sessions ---------------------------------------------------------

    def session(self, repo, number, column=None, skill=None, ticket=None, mode=None):
        issue, body = self._fetch(repo, number)
        summary = self._summary(repo, issue, body)
        column = validate_column(column or summary["column"])
        skill = validate_skill(skill)
        if mode not in (None, "implement-spec"):
            raise KipoError(f"{mode!r} is not a session mode.", "invalid_mode", 400)
        repo_path = self._repo_path(repo, body["meta"]) or ""
        sessions = self.storage.get_sessions(repo, number)

        if mode == "implement-spec":
            if column != "build":
                raise KipoError("implement-spec runs in Build.", "invalid_mode", 400)
            key, seed_ticket, skill = "build-spec", None, skill or "implement-spec"
        elif ticket is not None:
            ticket = _issue_number(ticket)
            if column == "build":
                seed_ticket = self._build_ticket(repo, number, ticket)
                key, skill = f"build-t{ticket}", skill or "implement"
            elif column == "shape":
                found = self.gh.view_issue(repo, ticket)
                seed_ticket = {"number": ticket, "title": (found or {}).get("title") or ""}
                key = f"shape-t{ticket}"
            else:
                raise KipoError(
                    f"{column.capitalize()} has no ticket sessions; only Build and Shape do.", "invalid_ticket", 400
                )
        else:
            key, seed_ticket = column, None
            if column == "plan" and sessions.get("grill"):
                # Grill and Plan share one unbroken context.
                slot = sessions["grill"]
                self.storage.record_session(repo, number, "plan", slot)
                return {"slotName": slot, "seed": render_plan_handoff(summary, skill), "existing": True}

        slot = session_name(repo, number, key)
        self.storage.record_session(repo, number, key, slot)
        return {
            "slotName": slot,
            "seed": render_seed(summary, repo_path, column, ticket=seed_ticket, skill=skill,
                                state_key=None if key in COLUMNS else key),
            "existing": False,
        }

    def _build_ticket(self, repo, number, ticket):
        """A ticket an agent can build in this effort: one of its ``kipo:<n>``
        tickets, a child of its wayfinder map, or the issue it started from."""
        nodes, _ = self._ticket_nodes(repo, number)
        found = next((n for n in nodes if n["number"] == ticket), None)
        if not found:
            issue, body = self._fetch(repo, number)
            meta = body["meta"]
            artifacts = merge_artifacts(
                body["artifacts"],
                col_state.state_artifacts(col_state.read_state(self._repo_path(repo, meta), number)),
            )
            meta = derive_meta(meta, artifacts)
            if meta.get("mapIssue"):
                children, _ = self._map_children(repo, int(meta["mapIssue"]))
                found = next((n for n in children if n["number"] == ticket), None)
            if not found and source_issue_of(repo, meta, artifacts) == ticket:
                seen = self.gh.view_issue(repo, ticket) or {}
                found = {"number": ticket, "title": seen.get("title") or "", "url": seen.get("url") or "",
                         "state": seen.get("state") or "OPEN", "blockers": []}
        if not found:
            raise KipoError(f"Issue #{ticket} is not a ticket of effort #{number}.", "not_ticket", 404)
        blocked = [b["number"] for b in found["blockers"] if b["state"] == "OPEN"]
        if blocked:
            listed = ", ".join(f"#{b}" for b in blocked)
            raise KipoError(
                f"Ticket #{ticket} is blocked by {listed}. Its build can start once they are closed.",
                "ticket_blocked",
                409,
                extra={"blockedBy": blocked},
            )
        return found

    def skill(self, skill):
        """The "Run /<skill>" line, for a session that already exists."""
        if not isinstance(skill, str) or not skill:
            raise KipoError("Say which skill to run.", "unknown_skill", 400)
        return {"message": run_line(validate_skill(skill))}

    # -- docs and frontier -------------------------------------------------

    def doc(self, repo, number, href):
        issue, body = self._fetch(repo, number)
        repo_path = self._repo_path(repo, body["meta"])
        return docs.read_doc(self.gh, repo, repo_path, href)

    def ticket(self, repo, number, ticket):
        """One ticket's card: its body and its latest comment (wayfinder posts a
        resolved ticket's answer as a comment before closing it)."""
        validate_repo_slug(repo)
        issue = self.gh.view_issue_comments(repo, ticket) or {}
        comments = issue.get("comments") or []
        last = comments[-1] if comments else None
        return {
            "number": ticket,
            "title": issue.get("title") or "",
            "url": issue.get("url") or "",
            "state": (issue.get("state") or "OPEN").upper(),
            "body": issue.get("body") or "",
            "lastComment": {
                "author": ((last.get("author") or {}).get("login") or ""),
                "body": last.get("body") or "",
                "createdAt": last.get("createdAt") or "",
            } if last else None,
            "comments": len(comments),
        }

    def frontier(self, repo, number):
        """Open, unblocked, unassigned children of the wayfinder map (Shape)."""
        issue, body = self._fetch(repo, number)
        # The map is usually charted mid-Shape, before advance writes it into
        # the meta comment, so read it through the same derivation the detail uses.
        artifacts = merge_artifacts(
            body["artifacts"],
            col_state.state_artifacts(col_state.read_state(self._repo_path(repo, body["meta"]), number)),
        )
        map_issue = derive_meta(body["meta"], artifacts).get("mapIssue")
        if map_issue:
            return self._map_frontier(repo, int(map_issue))
        return {"tickets": []}

    def _map_frontier(self, repo, map_issue):
        owner, name = repo.split("/", 1)
        note = None
        try:
            data = self.gh.graphql(_FRONTIER_QUERY.replace("BLOCKED", _BLOCKED_FIELD), owner=owner, name=name, number=map_issue)
        except KipoError as e:
            if "blockedBy" not in e.message:
                raise
            # The issue dependencies API is unavailable: treat every child as unblocked.
            data = self.gh.graphql(_FRONTIER_QUERY.replace("BLOCKED", ""), owner=owner, name=name, number=map_issue)
            note = "Issue dependencies are unavailable, so blocking was not checked."
        issue = (((data or {}).get("data") or {}).get("repository") or {}).get("issue")
        if not issue:
            raise KipoError(f"Map issue #{map_issue} was not found in {repo}.", "map_not_found", 404)
        tickets = []
        for node in (issue.get("subIssues") or {}).get("nodes") or []:
            if node.get("state") != "OPEN":
                continue
            if (node.get("assignees") or {}).get("totalCount"):
                continue
            blockers = (node.get("blockedBy") or {}).get("nodes") or []
            if any(b.get("state") == "OPEN" for b in blockers):
                continue
            tickets.append(_ticket({**node, "labels": (node.get("labels") or {}).get("nodes") or []}))
        result = {"tickets": tickets}
        if note:
            result["note"] = note
        return result


_BLOCKED_FIELD = "blockedBy(first: 50) { nodes { state } }"
_FRONTIER_QUERY = (
    "query($owner: String!, $name: String!, $number: Int!) {"
    " repository(owner: $owner, name: $name) { issue(number: $number) {"
    " subIssues(first: 100) { nodes { number title url state"
    " assignees(first: 1) { totalCount } labels(first: 50) { nodes { name } } BLOCKED } } } } }"
)

_TICKET_BLOCKED_FIELD = "blockedBy(first: 50) { nodes { number state } }"
_MAP_QUERY = (
    "query($owner: String!, $name: String!, $number: Int!) {"
    " repository(owner: $owner, name: $name) { issue(number: $number) { body"
    " subIssues(first: 100) { nodes { number title url state"
    " assignees(first: 1) { totalCount } labels(first: 50) { nodes { name } } BLOCKED } } } } }"
)
# LABELS is replaced with a JSON list literal; GitHub's labels filter matches any of them.
_TICKETS_QUERY = (
    "query($owner: String!, $name: String!) {"
    " repository(owner: $owner, name: $name) {"
    " issues(first: 100, labels: LABELS, states: [OPEN, CLOSED], orderBy: {field: CREATED_AT, direction: ASC}) {"
    " nodes { number title url state labels(first: 50) { nodes { name } } BLOCKED } } } }"
)
_COUNT_QUERY = (
    "query($owner: String!, $name: String!, $cursor: String) {"
    " repository(owner: $owner, name: $name) {"
    " issues(first: 100, after: $cursor, labels: LABELS, states: [OPEN, CLOSED],"
    " orderBy: {field: UPDATED_AT, direction: DESC}) {"
    " pageInfo { hasNextPage endCursor } nodes { number state labels(first: 50) { nodes { name } } } } } }"
)


def _ticket(issue):
    labels = label_names(issue)
    kind = next((l.split(":", 1)[1] for l in labels if l.startswith("wayfinder:")), None)
    return {"number": issue["number"], "title": issue["title"], "url": issue["url"], "labels": labels, "type": kind}
