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
import shlex

from . import COLUMNS, DEFAULT_START, PATHS, SKILLS, STARTS, KipoError, run_line
from . import activity as col_activity
from . import closing
from . import stalls
from . import docs
from . import frontier as frontier_mod
from . import reports as col_reports
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


_NAMED_RE = re.compile(r"(?<![\w/.#-])#(\d+)\b")


def named_issues(text):
    """Issue numbers named in ``text`` as ``#n`` (not ``other/repo#n``), in order."""
    found = []
    for m in _NAMED_RE.finditer(text or ""):
        n = int(m.group(1))
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


STAGE_NAMES = {"intake": "Intake", "decide": "Decide", "deliver": "Deliver", "done": "Done"}

# What each kind of conversation is for, as its seed says it. A ticket's
# conversation is named by its ticket; the rest by their key.
CONVERSATIONS = {
    "build-spec": "build every ready ticket in one run (/implement-spec)",
    "plan": "the hand-over: the spec, then the tickets",
    "review": "review and merge the effort's PRs",
    "done": "the retro",
}


def conversation_of(key, ticket=None):
    if ticket is not None:
        if key.startswith("review-"):
            return f"ticket #{ticket['number']}'s review: its PR reviewed, fixed and merged"
        lane = "Deliver" if key.startswith("build-") else "Decide"
        return f"ticket #{ticket['number']}, in the {lane} lane"
    return CONVERSATIONS.get(key, "the effort's own conversation")


# KiPo's command line, beside the backend that's running it (the installed app's copy).
KIPO_CLI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kipo_cli.py")


def report_line(effort, repo_path, source):
    """The seed's Report line: how a stage session tells the conductor what happened."""
    checkout = f" --checkout {shlex.quote(repo_path)}" if repo_path else ""
    return (f"Report: python3 {KIPO_CLI} report {effort['repo']} {effort['number']} --from {source}{checkout} "
            '--event <kind> --text "<one line>" [--item "<one per question, PR or issue>"]...')


def render_seed(effort, repo_path, column, ticket=None, skill=None, state_key=None, stage=None):
    """The first message of a KiPo conversation: which conversation this is,
    the effort's stage, and the skill to load. Every conversation has its own
    state file, named by its key: ``state_key`` (a ticket's, ``build-spec``),
    else the stage's ``column``."""
    n = effort["number"]
    stage = stage or frontier_mod.LEGACY_STAGE.get(column, "intake")
    lines = [
        f'[KiPo] Effort #{n} "{effort["title"]}" in {effort["repo"]}',
        f"Conversation: {conversation_of(state_key or column, ticket)}",
        f"Stage: {STAGE_NAMES.get(stage, stage)}",
        f"Start: {effort['start']}",
        f"Repo checkout: {repo_path}",
        f"Effort issue: {effort['url']}",
        f"State file: {col_state.session_state_path(repo_path, n, state_key or column)}",
        # Its own session key (build-t22, review-t22), so the close rule can tell
        # a ticket's build from its review.
        report_line(effort, repo_path, state_key or column),
    ]
    if ticket is not None:
        lines.append(f'Ticket: #{ticket["number"]} "{ticket["title"]}"')
        if ticket.get("blockers"):
            listed = ", ".join(f"#{b['number']} ({b['state'].lower()})" for b in ticket["blockers"])
            lines.append(f"Blocked by: {listed}")
        if "prs" in ticket:
            listed = ", ".join(f"#{p['number']} {p['url']}".strip() for p in ticket["prs"])
            lines.append(f"PRs: {listed or 'none open'}")
    lines.append(f"Load the skill `kipo-{column}` and follow it. Destination: {effort['destination']}")
    if skill:
        lines.append(run_line(skill))
    return "\n".join(lines)


CONDUCTOR_AGENT = "kipo-conductor"


def render_conductor_seed(effort, repo_path):
    """The first message of the effort's conductor: what to read and how to dispatch."""
    n, repo = effort["number"], effort["repo"]
    return "\n".join([
        f'[KiPo] Effort #{n} "{effort["title"]}" in {repo}',
        "Conversation: the conductor, the effort's own conversation",
        f"Repo checkout: {repo_path}",
        f"Effort issue: {effort['url']}",
        f"State file: {col_state.session_state_path(repo_path, n, 'conductor')}",
        f"Frontier: python3 {KIPO_CLI} frontier {repo} {n}",
        f"Dispatch: python3 {KIPO_CLI} dispatch {repo} {n} (--ticket <t> | --stage grill|intake|shape|plan|review|done)"
        " [--skill <thread's skill>: always when a ticket thread's skill isn't kipo-build]",
        f"Reports: python3 {KIPO_CLI} reports {repo} {n}"
        + (f" --checkout {shlex.quote(repo_path)}" if repo_path else "")
        + " (only when the frontier fails: the frontier carries them)",
        f"Sessions: python3 {KIPO_CLI} sessions {repo} {n} (each session KiPo opened: open, closable or closed; stalled, woken or stuck)",
        f"Load the skill `kipo-conductor` and follow it. Destination: {effort['destination']}",
        "Start with a wake: run the frontier, then report where the effort stands.",
    ])


def render_plan_handoff(effort, skill=None, repo_path=None):
    """What goes into the grilling conversation when the human chooses to write the spec."""
    text = ("The hand-over: write the spec, then the tickets, from what this conversation decided. "
            "Load the skill `kipo-plan` and follow it. From now on keep the hand-over's own state file "
            "and report as the hand-over:\n"
            f"State file: {col_state.session_state_path(repo_path, effort['number'], 'plan')}\n"
            + report_line(effort, repo_path, "plan"))
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


_SPEC_ITEM_RE = re.compile(r"^\s*#(\d+)\s+Spec\b", re.I)


def spec_issues(repo, nodes, artifacts, reports=()):
    """The effort's spec issues among its tickets: a spec is a parent, not
    work. Each ticket that is the native sub-issue parent of another of the
    effort's tickets (``to-tickets`` makes each ticket the spec's sub-issue),
    each issue a "Spec" artifact names in this repo (plan.json and the
    older state.json may each carry one), and each issue a session reported
    creating as a spec (``issue-created`` with an item ``#<n> Spec: …``)."""
    numbers = {n["number"] for n in nodes}
    out = {n.get("parent") for n in nodes if n.get("parent") in numbers}
    for a in artifacts or []:
        if (a.get("label") or "").strip().lower() == "spec":
            href = a.get("href") or ""
            m = _ISSUE_URL_RE.search(href)
            if m and f"github.com/{repo.lower()}/issues/" in href.lower():
                out.add(int(m.group(1)))
    for r in reports or []:
        if isinstance(r, dict) and r.get("event") == "issue-created":
            for item in r.get("items") or []:
                m = _SPEC_ITEM_RE.match(item if isinstance(item, str) else "")
                if m:
                    out.add(int(m.group(1)))
    return sorted(n for n in out if n in numbers)


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
        # The stall rule's inputs that aren't GitHub's (kipo/activity.py).
        self.now = lambda: datetime.datetime.now(datetime.timezone.utc)
        self.transcript_activity = col_activity.transcript_activity
        # The slots Kiro Crew created (None: unknown), to tell a recorded
        # session that never started.
        self.known_slots = col_activity.known_slots
        # Each session's seed, read from its transcript (kipo/activity.py).
        self.transcript_seeds = col_activity.transcript_seeds
        # Each repo's last successful sidebar listing, served when GitHub
        # refuses a call (rate limit): the maps don't vanish, the UI says
        # "last known" instead.
        self._list_cache = {}

    # -- helpers ----------------------------------------------------------

    def _configured_path(self, repo):
        path = self.storage.repo_path(repo)
        if not path:
            raise KipoError(f"{repo} is not a configured repo.", "unknown_repo", 404)
        return path

    def _repo_path(self, repo, meta):
        return meta.get("repoPath") or self.storage.repo_path(repo)

    def repo_path(self, repo, number):
        """The effort's checkout: its meta's repoPath, else the repo's configured path."""
        _, body = self._fetch(repo, number)
        return self._repo_path(repo, body["meta"])

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
            # The wayfinder map it runs on: itself for a map, the effort's map otherwise.
            "mapIssue": issue["number"] if is_map(issue)
            else derive_meta(body["meta"], body.get("artifacts") or []).get("mapIssue"),
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
        fields = {"BLOCKED": _TICKET_BLOCKED_FIELD, "PARENT": _TICKET_PARENT_FIELD}
        while True:
            q = query
            for k, v in fields.items():
                q = q.replace(k, v)
            try:
                data = self.gh.graphql(q, owner=owner, name=name)
                break
            except KipoError as e:
                # A tracker without issue dependencies or sub-issues: drop that field.
                if fields["BLOCKED"] and "blockedBy" in e.message:
                    fields["BLOCKED"] = ""
                    note = "Issue dependencies are unavailable, so blocking was not checked."
                elif fields["PARENT"] and "parent" in e.message:
                    fields["PARENT"] = ""
                else:
                    raise
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
                "parent": ((node.get("parent") or {}).get("number")),
            })
        nodes.sort(key=lambda n: n["number"])
        return nodes, note

    def _map_children(self, repo, map_issue):
        """Every child of the wayfinder map, open and closed, plus the map's body
        (for the fog) and whether the map is closed. Returns ``(nodes, body,
        closed)``; nodes as in ``_ticket_nodes``."""
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
        return nodes, issue.get("body") or "", (issue.get("state") or "OPEN").upper() == "CLOSED"

    def _prs(self, repo, number, ticket_numbers_):
        """The repo's PRs that belong to this effort, each with the tickets it closes."""
        return self._pr_lists(repo, number, ticket_numbers_)[0]

    def _pr_lists(self, repo, number, ticket_numbers_, named=None):
        """``(prs, ref_prs)`` from one ``gh pr list``: the effort's PRs (closing
        one of ``ticket_numbers_`` or the effort, or on its branch), and the
        open PRs that only name one of ``named`` (default: the same tickets),
        ``#n`` in the title or body with no closing keyword, each with
        ``refs``, the tickets it names."""
        mine = set(ticket_numbers_)
        named = set(named if named is not None else ticket_numbers_)
        prs, refs = [], []
        for pr in self.gh.list_prs(repo):
            closes = closed_issues(pr.get("body"), repo)
            tickets = [t for t in closes if t in mine]
            row = {
                "number": pr["number"],
                "title": pr.get("title") or "",
                "url": pr.get("url") or "",
                "state": (pr.get("state") or "OPEN").upper(),
                "isDraft": bool(pr.get("isDraft")),
                "headRefName": pr.get("headRefName") or "",
                "tickets": tickets,
            }
            if tickets or number in closes or on_effort_branch(pr.get("headRefName"), number):
                prs.append(row)
                continue
            names = [n for n in named_issues(f"{pr.get('title') or ''}\n{pr.get('body') or ''}") if n in named]
            if names and row["state"] == "OPEN":
                refs.append({**row, "refs": names})
        prs.sort(key=lambda p: p["number"])
        refs.sort(key=lambda p: p["number"])
        return prs, refs

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
        # The effort's map, spec and source issue: from state.json and the stage files.
        meta = derive_meta(meta, merge_artifacts(artifacts, col_state.effort_artifacts(repo_path, number)))
        sessions = self.storage.get_sessions(repo, number)
        # Each conversation's own state (a ticket's, a stage's): its skills,
        # decisions and documents.
        session_states = {}
        # When each conversation last wrote its own state file (the stall rule's
        # idle clock counts from it too).
        state_writes = {}
        for key in sessions:
            ss = col_state.read_session_state(repo_path, number, key)
            if ss:
                session_states[key] = ss
                artifacts = merge_artifacts(artifacts, col_state.state_artifacts(ss))
                try:
                    state_writes[key] = col_activity._iso(
                        os.path.getmtime(col_state.session_state_path(repo_path, number, key)))
                except OSError:
                    pass

        # state.json, from conversations seeded before each had its own file:
        # a ticket's decisions to its conversation, the rest to the stage
        # conversation that asked them (read-time only).
        all_reports = col_reports.all_reports(repo_path, number)
        st, session_states = col_state.route_ticket_decisions(st, session_states, sessions)
        st, session_states = col_state.route_stage_decisions(
            st, session_states, sessions, all_reports, self.storage.get_closed(repo, number))

        nodes, tickets_note, tickets_error = [], None, None
        try:
            nodes, tickets_note = self._ticket_nodes(repo, number)
        except KipoError as e:
            tickets_error = e.message
        # The spec issue is the tickets' parent, not a ticket: no tile, no build.
        specs = spec_issues(repo, nodes, artifacts, all_reports)
        spec_nodes = [n for n in nodes if n["number"] in specs]
        nodes = [n for n in nodes if n["number"] not in specs]
        # The frontier: build tickets and the map's children, each in its real state.
        map_nodes, map_body, map_closed = [], None, False
        if meta.get("mapIssue"):
            try:
                map_nodes, map_body, map_closed = self._map_children(repo, int(meta["mapIssue"]))
            except KipoError:
                map_nodes, map_body, map_closed = [], None, False
        prs, ref_prs, prs_error = [], [], None
        try:
            # A PR that closes the issue the effort started from is the effort's PR too.
            source = source_issue_of(repo, meta, artifacts)
            closers = [n["number"] for n in nodes + spec_nodes] + ([source] if source else [])
            # An open PR naming any of its tickets (a map child too) without closing it: refPrs.
            prs, ref_prs = self._pr_lists(repo, number, closers, closers + [n["number"] for n in map_nodes])
        except KipoError as e:
            prs_error = e.message
        tickets = [self._ticket_detail(n, prs, sessions) for n in nodes]
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
        front = frontier_mod.build(nodes, map_nodes, prs, sessions, map_body, source_node, map_closed=map_closed)
        front.update(frontier_mod.stage_of(front, column, prs))
        self.storage.save_frontier(repo, number, {
            "counts": front["counts"], "lanes": front["lanes"], "fog": front["fog"],
            "stage": front["stage"], "active": front["active"],
            "stations": frontier_mod.stations_summary(front, prs, bool(sessions.get("done"))),
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
            # Open PRs that name an effort ticket without closing it (the conductor's review threads).
            "refPrs": ref_prs,
            # The effort's spec issues: parents of its tickets, never tiles.
            "specIssues": specs,
            "frontier": front,
            "sessionStates": session_states,
            # What stage sessions told the conductor (kipo_cli.py report), and how far it has read.
            "reports": col_reports.read(repo_path, number),
        }
        # Each session with its close status (kipo/closing.py): the page closes the
        # closable ones; and, open ones, its stall (kipo/stalls.py): the page wakes
        # the stalled ones.
        now = self.now()
        live = {k: v for k, v in sessions.items() if k not in closing.NEVER}
        # When KiPo opened each session and whether its seed went out; the
        # recorded slots Kiro Crew never created.
        detail["starts"] = self.storage.get_starts(repo, number)
        # Each session's seed, from its transcript (when it opened; whether it
        # had a Report line): tells a session opened before KiPo kept starts
        # from one opened before reporting. And its own state file's last write.
        detail["seeds"] = self.transcript_seeds(live)
        detail["stateWrites"] = state_writes
        known = self.known_slots()
        detail["missingSlots"] = sorted(v for v in live.values() if known is not None and v not in known)
        activity = col_activity.merge(
            self.storage.get_activity(repo, number), self.transcript_activity(live), now)
        detail["closing"] = stalls.sessions(
            detail, all_reports, self.storage.get_closed(repo, number),
            activity, col_activity.read_wakes(repo_path, number), now)
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
                # Every open map in the repo, unless an effort already wraps
                # it or you hid it: an added repo lists all its maps.
                listed = {i["number"] for i in found}
                for issue in self.gh.list_issues(repo, MAP_LABEL):
                    n = issue["number"]
                    if is_map(issue) and n not in wrapped and n not in hidden and n not in listed:
                        found.append(self._summary(repo, issue, map_body(issue)))
            except KipoError as e:
                errors.append({"repo": repo, "error": e.message, "code": e.code})
                # GitHub refused (rate limit, a blip): the repo's maps didn't
                # really vanish, so show the last answer it gave instead of
                # nothing. The error above still tells the UI to say so.
                efforts += self._list_cache.get(repo, [])
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
            self._list_cache[repo] = list(found)
            efforts += found
        efforts.sort(key=lambda i: i["updatedAt"], reverse=True)
        # The configured repos themselves, so the sidebar can group by repo,
        # show an added repo even before it has maps, and restore hidden ones.
        repos = [
            {"slug": r["slug"], "path": r.get("path", ""), "hidden": sorted(self.storage.hidden(r["slug"]))}
            for r in self.storage.get_config()["repos"]
            if r.get("slug") and not r.get("worktree")
        ]
        result = {"initiatives": efforts, "repos": repos}
        if errors:
            result["errors"] = errors
        return result

    MAPS_PER_QUERY = 20

    def maps_progress(self, repo, numbers):
        """``{map number: {counts, lanes, fog}}`` for several wayfinder maps, from
        one GraphQL query per 20 maps: each map's children read as an effort's."""
        owner, name = repo.split("/", 1)
        out = {}
        numbers = sorted(set(int(n) for n in numbers))
        for i in range(0, len(numbers), self.MAPS_PER_QUERY):
            chunk = numbers[i:i + self.MAPS_PER_QUERY]

            def query(blocked):
                parts = " ".join(
                    f"m{n}: issue(number: {n}) {{ body state subIssues(first: 100) {{ nodes {{ number title url state"
                    f" assignees(first: 1) {{ totalCount }} labels(first: 50) {{ nodes {{ name }} }} {blocked} }} }} }}"
                    for n in chunk
                )
                return "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { " + parts + " } }"

            try:
                data = self.gh.graphql(query(_TICKET_BLOCKED_FIELD), owner=owner, name=name)
            except KipoError as e:
                if "blockedBy" not in e.message:
                    raise
                data = self.gh.graphql(query(""), owner=owner, name=name)
            found = ((data or {}).get("data") or {}).get("repository") or {}
            for n in chunk:
                issue = found.get(f"m{n}")
                if not issue:
                    continue
                nodes = []
                for node in (issue.get("subIssues") or {}).get("nodes") or []:
                    blockers = (node.get("blockedBy") or {}).get("nodes") or []
                    nodes.append({
                        "number": node["number"], "title": node.get("title") or "", "url": node.get("url") or "",
                        "state": node.get("state") or "OPEN",
                        "labels": [l["name"] for l in (node.get("labels") or {}).get("nodes") or []],
                        "blockers": [{"number": b["number"], "state": b.get("state") or "OPEN"} for b in blockers if "number" in b],
                        "assigned": bool((node.get("assignees") or {}).get("totalCount")),
                    })
                closed = (issue.get("state") or "OPEN").upper() == "CLOSED"
                f = frontier_mod.build([], nodes, [], {}, issue.get("body") or "", map_closed=closed)
                out[n] = {"counts": f["counts"], "lanes": f["lanes"], "fog": f["fog"], "fogLeft": len(f["fogLeft"])}
        return out

    def wrapped_maps(self, repo):
        """``{map number: effort number}`` for the efforts in a repo that point at a map."""
        out = {}
        for issue in self.gh.list_issues(repo, EFFORT_LABEL):
            m = self._map_of(repo, issue["number"], parse_body(issue.get("body")))
            if m:
                out[m] = issue["number"]
        return out

    def hide(self, repo, number):
        """Take an effort or a map off the sidebar; GitHub isn't touched.
        Every added repo lists all its maps, so a map is hidden the same way
        an effort is — restorable from its repo's "removed" line."""
        validate_repo_slug(repo)
        if number in self.storage.opened_maps(repo):
            self.storage.close_map(repo, number)
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
        artifacts = merge_artifacts(body["artifacts"], col_state.effort_artifacts(path, number) if path else [])
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

    def record_closed(self, repo, number, keys):
        """The page closed these sessions (kipo/closing.py's rule): remember them."""
        sessions = self.storage.get_sessions(repo, number)
        if not isinstance(keys, list) or not all(isinstance(k, str) for k in keys):
            raise KipoError("keys must be a list of session keys.", "invalid_keys", 400)
        unknown = [k for k in keys if k not in sessions or k in closing.NEVER]
        if unknown:
            raise KipoError(f"Not closable session keys: {', '.join(unknown)}.", "invalid_keys", 400)
        when = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return {"closed": self.storage.record_closed(repo, number, keys, when)}

    def record_activity(self, repo, number, observations):
        """What the page read from Kiro Crew for each open session
        (``{key: {at, running, agent}}``): kept for the stall rule."""
        sessions = self.storage.get_sessions(repo, number)
        if not isinstance(observations, dict):
            raise KipoError("activity must be an object of session keys.", "invalid_activity", 400)
        clean = {k: o for k, o in ((k, col_activity.clean_observation(v)) for k, v in observations.items())
                 if k in sessions and o}
        seen = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.storage.record_activity(repo, number, clean, seen)
        return {"recorded": sorted(clean)}

    def record_started(self, repo, number, key):
        """The page sent this session's seed (or its hand-over message): it
        has started. Until then a recorded session hasn't (kipo/closing.py)."""
        sessions = self.storage.get_sessions(repo, number)
        if not isinstance(key, str) or key not in sessions:
            raise KipoError(f"Not a session of this effort: {key!r}.", "invalid_key", 400)
        return {"started": self.storage.mark_seeded(repo, number, key)}

    def record_wake(self, repo, number, key, stall, why):
        """The page woke a stalled session (kipo/stalls.py): record it in the
        effort's checkout (.kipo/<n>/wakes.json), once per stall."""
        sessions = self.storage.get_sessions(repo, number)
        if not isinstance(key, str) or key not in sessions or key in closing.NEVER:
            raise KipoError(f"Not a stage session of this effort: {key!r}.", "invalid_key", 400)
        if not isinstance(stall, str) or not stall:
            raise KipoError("stall must name the stall woken for.", "invalid_stall", 400)
        repo_path = self.repo_path(repo, number)
        if not repo_path:
            raise KipoError("No repo checkout is known for this effort.", "no_checkout", 409)
        return {"wake": col_activity.record_wake(repo_path, number, key, stall, str(why or ""))}

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
        body["artifacts"] = merge_artifacts(body["artifacts"], col_state.effort_artifacts(repo_path, number))
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

    def session(self, repo, number, column=None, skill=None, ticket=None, mode=None, replace=False):
        issue, body = self._fetch(repo, number)
        summary = self._summary(repo, issue, body)
        column = validate_column(column or summary["column"])
        # The column's own KiPo skill (kipo-review in review) is what its seed
        # loads anyway: not a skill to run on top.
        skill = validate_skill(None if skill == f"kipo-{column}" else skill)
        if mode not in (None, "implement-spec", "conductor"):
            raise KipoError(f"{mode!r} is not a session mode.", "invalid_mode", 400)
        repo_path = self._repo_path(repo, body["meta"]) or ""
        sessions = self.storage.get_sessions(repo, number)

        if mode == "conductor":
            # The effort's own conversation, run by the kipo-conductor agent.
            slot = session_name(repo, number, "conductor")
            self.storage.record_session(repo, number, "conductor", slot)
            return {"slotName": slot, "key": "conductor", "agent": CONDUCTOR_AGENT, "existing": False,
                    "seed": render_conductor_seed(summary, repo_path)}

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
            elif column == "review":
                # One ticket's review (kipo-review): its own conversation beside
                # the build's, seeded with the ticket and its open PRs.
                found = self.gh.view_issue(repo, ticket)
                # Its open PRs: those closing it, and those only naming it (#t),
                # which it reviews even once the ticket closed.
                closers, namers = self._pr_lists(repo, number, [ticket])
                prs = sorted([p for p in closers if ticket in p["tickets"] and p["state"] == "OPEN"] + namers,
                             key=lambda p: p["number"])
                seed_ticket = {"number": ticket, "title": (found or {}).get("title") or "", "prs": prs}
                key = f"review-t{ticket}"
            else:
                raise KipoError(
                    f"{column.capitalize()} has no ticket sessions; only Build, Shape and Review do.",
                    "invalid_ticket", 400,
                )
        else:
            key, seed_ticket = column, None
            if column == "plan" and sessions.get("grill") and not replace:
                # Grill and Plan share one unbroken context.
                slot = sessions["grill"]
                self.storage.record_session(repo, number, "plan", slot)
                return {"slotName": slot, "key": "plan", "seed": render_plan_handoff(summary, skill, repo_path),
                        "existing": True}

        slot = session_name(repo, number, key)
        if replace and sessions.get(key):
            # A re-dispatch replaces the thread's dead session: a fresh slot, so
            # nothing of the old one (closed in Kiro Crew by the page) carries over.
            used = {sessions[key], *self.storage.get_starts(repo, number).get(key, {}).get("replaced", [])}
            k = 2
            while f"{slot}-r{k}" in used:
                k += 1
            slot = f"{slot}-r{k}"
        self.storage.record_session(repo, number, key, slot)
        return {
            "slotName": slot,
            "key": key,
            "seed": render_seed(summary, repo_path, column, ticket=seed_ticket, skill=skill,
                                state_key=key,
                                stage=(self.storage.get_frontier(repo, number) or {}).get("stage")),
            "existing": False,
        }

    def _build_ticket(self, repo, number, ticket):
        """A ticket an agent can build in this effort: one of its ``kipo:<n>``
        tickets, a child of its wayfinder map, or the issue it started from."""
        nodes, _ = self._ticket_nodes(repo, number)
        found = next((n for n in nodes if n["number"] == ticket), None)
        if found:
            _, body = self._fetch(repo, number)
            path = self._repo_path(repo, body["meta"])
            artifacts = merge_artifacts(body["artifacts"], col_state.effort_artifacts(path, number))
            if ticket in spec_issues(repo, nodes, artifacts, col_reports.all_reports(path, number)):
                raise KipoError(f"#{ticket} is the effort's spec: its tickets are the work, not the spec.",
                                "is_spec", 409)
        if not found:
            issue, body = self._fetch(repo, number)
            meta = body["meta"]
            artifacts = merge_artifacts(
                body["artifacts"],
                col_state.effort_artifacts(self._repo_path(repo, meta), number),
            )
            meta = derive_meta(meta, artifacts)
            if meta.get("mapIssue"):
                children, _, _ = self._map_children(repo, int(meta["mapIssue"]))
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
            col_state.effort_artifacts(self._repo_path(repo, body["meta"]), number),
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
    " repository(owner: $owner, name: $name) { issue(number: $number) { body state"
    " subIssues(first: 100) { nodes { number title url state"
    " assignees(first: 1) { totalCount } labels(first: 50) { nodes { name } } BLOCKED } } } } }"
)
# LABELS is replaced with a JSON list literal; GitHub's labels filter matches any of them.
_TICKETS_QUERY = (
    "query($owner: String!, $name: String!) {"
    " repository(owner: $owner, name: $name) {"
    " issues(first: 100, labels: LABELS, states: [OPEN, CLOSED], orderBy: {field: CREATED_AT, direction: ASC}) {"
    " nodes { number title url state labels(first: 50) { nodes { name } } BLOCKED PARENT } } } }"
)
# The ticket's native sub-issue parent: a ticket that is another's parent is the spec.
_TICKET_PARENT_FIELD = "parent { number }"
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
