"""Initiatives: the issue body format, label logic, advance, sessions, tickets and frontier."""
import datetime
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

from . import OLD_DELIVERY_PHASES, PHASES, SHIP_MODES, SIZES, STAGES, WORK_STAGES, KipoError
from . import docs
from . import state as phase_state

INITIATIVE_LABEL = "kipo:initiative"
META_KEYS = ("repoPath", "size", "mapIssue", "specPath")

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
    """Render ``{destination, artifacts, phaseLog, meta}`` as the issue body."""
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


def merge_artifacts(*lists):
    """Concatenate artifact lists, keeping the first entry for each href."""
    seen, merged = set(), []
    for items in lists:
        for a in items or []:
            if a["href"] not in seen:
                seen.add(a["href"])
                merged.append(a)
    return merged


# -- labels -------------------------------------------------------------

def label_names(issue):
    return [l["name"] if isinstance(l, dict) else str(l) for l in issue.get("labels") or []]


def _label_values(labels, prefix):
    return [l[len(prefix):] for l in labels if l.startswith(prefix)]


def phase_from_labels(labels):
    """The current phase: the furthest ``phase:`` label present, else intake.

    The one-level model's ``phase:build|review|test|security`` read as ``delivery``.
    """
    found = []
    for value in _label_values(labels, "phase:"):
        if value in OLD_DELIVERY_PHASES:
            value = "delivery"
        if value in PHASES:
            found.append(value)
    if not found:
        return PHASES[0]
    return max(found, key=PHASES.index)


def old_delivery_stage(labels):
    """For an initiative still labelled with an old phase, that phase as a stage."""
    found = [v for v in _label_values(labels, "phase:") if v in OLD_DELIVERY_PHASES]
    return max(found, key=STAGES.index) if found else None


def stage_from_labels(labels):
    """A ticket's stage: the furthest ``stage:`` label present, else None."""
    found = [v for v in _label_values(labels, "stage:") if v in STAGES]
    return max(found, key=STAGES.index) if found else None


def next_stage(stage, ship):
    """The stage a ticket advances to, or None when it can't advance."""
    if stage in WORK_STAGES:
        return STAGES[STAGES.index(stage) + 1]
    if stage == "ready" and ship == "each":
        return "shipped"
    return None


def ticket_session_stage(stage, ship):
    """The skill a ticket's session runs at its stage, or None when it has no session."""
    if stage in WORK_STAGES:
        return stage
    if stage == "ready" and ship == "each":
        return "release"
    return None


def ship_mode(value):
    return value if value in SHIP_MODES else None


def delivery_summary(tickets, ship):
    """The computed delivery gate over the initiative's tickets."""
    ship = ship or "together"
    # A closed ticket that never got a stage (closed as not planned) is not part of delivery.
    counted = [t for t in tickets if t["stage"] or t["state"] == "OPEN"]
    by_stage = {s: 0 for s in STAGES}
    for t in counted:
        if t["stage"]:
            by_stage[t["stage"]] += 1
    done = ("ready", "shipped") if ship == "together" else ("shipped",)
    left = [t for t in counted if t["stage"] not in done]
    total = len(counted)
    if not total:
        reason = "There are no tickets yet."
    elif left:
        noun = "ticket" if total == 1 else "tickets"
        verb = "isn't" if len(left) == 1 else "aren't"
        word = "ready" if ship == "together" else "shipped"
        reason = f"{len(left)} of {total} {noun} {verb} {word} yet."
    else:
        reason = None
    return {"total": total, "byStage": by_stage, "canAdvance": reason is None, "reason": reason}


def blocks(blocker):
    """A blocker blocks while it is open and, if it is one of our tickets, not yet ready.

    In ship-together mode tickets stay open until Release merges them, so a
    ``ready``/``shipped`` blocker has to count as done or every dependent would deadlock.
    """
    return blocker["state"] == "OPEN" and blocker.get("stage") not in ("ready", "shipped")


def blocker_note(blocker):
    stage = blocker.get("stage")
    if stage in ("ready", "shipped"):
        return f"now {stage}"
    if stage:
        return stage
    return "closed" if blocker["state"] == "CLOSED" else "open"


def pr_url(ticket_state):
    for a in phase_state.state_artifacts(ticket_state):
        if a["label"].strip().lower() == "pr":
            return a["href"]
    return None


def size_from(meta, labels):
    if meta.get("size") in SIZES:
        return meta["size"]
    for l in labels:
        if l.startswith("size:") and l[5:] in SIZES:
            return l[5:]
    return None


def next_phase(phase):
    i = PHASES.index(phase)
    return PHASES[i + 1] if i + 1 < len(PHASES) else None


# -- names and seeds ----------------------------------------------------

def slugify(text):
    return re.sub(r"[^a-z0-9]", "-", text.lower())


def session_key(phase, ticket=None):
    return f"{phase}-t{ticket}" if ticket is not None else phase


def session_name(repo, number, phase, ticket=None):
    owner, name = repo.split("/", 1)
    return slugify(f"kipo-{owner}-{name}-{number}-{session_key(phase, ticket)}")


def ticket_session_key(ticket, stage):
    return f"t{ticket}-{stage}"


def ticket_session_name(repo, number, ticket, stage):
    owner, name = repo.split("/", 1)
    return slugify(f"kipo-{owner}-{name}-{number}-{ticket_session_key(ticket, stage)}")


def render_seed(initiative, repo_path, phase, ticket=None, ship=None):
    n = initiative["number"]
    lines = [
        f'[KiPo] Initiative #{n} "{initiative["title"]}" in {initiative["repo"]}',
        f"Phase: {phase} ({PHASES.index(phase) + 1} of {len(PHASES)})",
        f"Repo checkout: {repo_path}",
        f"Initiative issue: {initiative['url']}",
        f"State file: {phase_state.state_path(repo_path, n)}",
        f"Size: {initiative['size'] or 'unset'}",
    ]
    if ship:
        lines.append(f"Ship: {ship}")
    if ticket is not None:
        lines.append(f"Ticket: #{ticket}")
    lines.append(f"Load the skill `phase-{phase}` and follow it. Destination: {initiative['destination']}")
    return "\n".join(lines)


def render_ticket_seed(initiative, repo_path, stage, ticket, ship=None):
    n, t = initiative["number"], ticket["number"]
    lines = [
        f'[KiPo] Initiative #{n} "{initiative["title"]}" in {initiative["repo"]}',
        f'Stage: {stage} for ticket #{t} "{ticket["title"]}"',
        f"Repo checkout: {repo_path}",
        f"Initiative issue: {initiative['url']}",
        f"Ticket issue: {ticket['url']}",
        f"State file: {phase_state.ticket_state_path(repo_path, n, t)}",
        f"Size: {initiative['size'] or 'unset'}",
    ]
    if ship:
        lines.append(f"Ship: {ship}")
    if ticket.get("blockers"):
        listed = ", ".join(f"#{b['number']} ({blocker_note(b)})" for b in ticket["blockers"])
        lines.append(f"Blocked by: {listed}")
    lines.append(f"Load the skill `phase-{stage}` and follow it. Destination: {initiative['destination']}")
    return "\n".join(lines)


_ISSUE_URL_RE = re.compile(r"/issues/(\d+)(?:[#?].*)?$")


def derive_meta(meta, artifacts):
    """Fill mapIssue and specPath from the "Wayfinder map" and "Spec" artifacts
    when the meta comment doesn't carry them yet."""
    derived = dict(meta)
    for artifact in artifacts:
        label = (artifact.get("label") or "").strip().lower()
        href = artifact.get("href") or ""
        if label == "wayfinder map" and not derived.get("mapIssue"):
            m = _ISSUE_URL_RE.search(href)
            if m:
                derived["mapIssue"] = int(m.group(1))
        elif label == "spec" and not derived.get("specPath"):
            derived["specPath"] = href
    return derived


# -- service ------------------------------------------------------------

TITLE_MAX = 72


def title_from(description):
    """A short issue title from a free-form description; Intake can rename it."""
    first = re.split(r"(?<=[.!?])\s|\n", description.strip(), maxsplit=1)[0].strip().rstrip(".")
    if len(first) <= TITLE_MAX:
        return first
    cut = first[:TITLE_MAX].rsplit(" ", 1)[0]
    return f"{cut}…"


def validate_repo_slug(repo):
    if not isinstance(repo, str) or not _SLUG_RE.match(repo):
        raise KipoError("The repo must look like owner/name.", "invalid_repo", 400)


class Initiatives:
    # Ticket label edits run in parallel so a detail fetch stays under the proxy's 30 s.
    LABEL_WORKERS = 8

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
        return {
            "repo": repo,
            "number": issue["number"],
            "title": issue["title"],
            "url": issue["url"],
            "phase": phase_from_labels(labels),
            "size": size_from(body["meta"], labels),
            "destination": body["destination"],
            "updatedAt": issue.get("updatedAt") or "",
        }

    def _fetch(self, repo, number):
        validate_repo_slug(repo)
        issue = self.gh.view_issue(repo, number)
        if not issue or INITIATIVE_LABEL not in label_names(issue):
            raise KipoError(f"Issue #{number} in {repo} is not a KiPo initiative.", "not_initiative", 404)
        return issue, parse_body(issue.get("body"))

    # -- tickets ----------------------------------------------------------

    def _ticket_nodes(self, repo, number):
        """Every ``kipo:<n>`` issue, open and closed, with labels and blockers.

        Returns ``(nodes, note)``; each node has a ``labels`` name list and a
        ``blockers`` list of every native blocker as ``{number, state}``.
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

    def _set_stage(self, repo, node, stage):
        """Move a ticket's ``stage:`` label to ``stage``, in GitHub and in ``node``."""
        label = f"stage:{stage}"
        stale = [l for l in node["labels"] if l.startswith("stage:") and l != label]
        self.gh.ensure_label(repo, label)
        self.gh.edit_issue(repo, node["number"], add_labels=[label], remove_labels=stale)
        node["labels"] = [l for l in node["labels"] if l not in stale] + ([label] if label not in node["labels"] else [])

    def _set_stages(self, repo, moves):
        """Apply ``[(node, stage)]`` label moves in parallel."""
        if not moves:
            return
        if len(moves) == 1:
            self._set_stage(repo, *moves[0])
            return
        with ThreadPoolExecutor(max_workers=min(self.LABEL_WORKERS, len(moves))) as pool:
            for f in [pool.submit(self._set_stage, repo, node, stage) for node, stage in moves]:
                f.result()

    def _label_stageless(self, repo, nodes, stage):
        moves = [(n, stage) for n in nodes if n["state"] == "OPEN" and not stage_from_labels(n["labels"])]
        self._set_stages(repo, moves)

    def _ticket_detail(self, node, repo_path, number, ship, stages):
        """``stages`` maps every ticket of the initiative to its stage, to judge blockers."""
        stage = stage_from_labels(node["labels"])
        ts = phase_state.read_ticket_state(repo_path, number, node["number"])
        session_stage = ticket_session_stage(stage, ship)
        blockers = [{**b, "stage": stages.get(b["number"])} for b in node["blockers"]]
        return {
            "number": node["number"],
            "title": node["title"],
            "url": node["url"],
            "state": node["state"],
            "labels": node["labels"],
            "stage": stage,
            "blockedBy": [b["number"] for b in blockers if blocks(b)],
            "blockers": blockers,
            "ticketState": ts,
            "gatePassed": phase_state.gate_passed(ts),
            "sessionKey": ticket_session_key(node["number"], session_stage) if session_stage else None,
            "prUrl": pr_url(ts),
        }

    # -- detail -----------------------------------------------------------

    def _detail(self, repo, issue, body):
        summary = self._summary(repo, issue, body)
        labels = label_names(issue)
        number = issue["number"]
        phase = summary["phase"]
        meta = body["meta"]
        repo_path = self._repo_path(repo, meta)
        st = phase_state.read_state(repo_path, number)
        artifacts = merge_artifacts(body["artifacts"], phase_state.state_artifacts(st))
        meta = derive_meta(meta, artifacts)
        ship = ship_mode(meta.get("ship")) or (ship_mode((st or {}).get("ship")) if phase == "design" else None)

        tickets, tickets_note, tickets_error = [], None, None
        try:
            nodes, tickets_note = self._ticket_nodes(repo, number)
            if phase == "delivery" and (issue.get("state") or "OPEN").upper() == "OPEN":
                # A ticket filed during delivery gets its first stage the first time we see it.
                self._label_stageless(repo, nodes, old_delivery_stage(labels) or STAGES[0])
            stages = {n["number"]: stage_from_labels(n["labels"]) for n in nodes}
            tickets = [self._ticket_detail(n, repo_path, number, ship or "together", stages) for n in nodes]
        except KipoError as e:
            tickets_error = e.message

        delivery = delivery_summary(tickets, ship) if phase in ("delivery", "release", "operate") else None
        detail = {
            **summary,
            "repoPath": repo_path or "",
            "mapIssue": meta.get("mapIssue"),
            "specPath": meta.get("specPath"),
            "artifacts": artifacts,
            "phaseLog": body["phaseLog"],
            "state": st,
            "gatePassed": delivery["canAdvance"] if phase == "delivery" else phase_state.gate_passed(st),
            "sessions": self.storage.get_sessions(repo, number),
            "ship": ship,
            "tickets": tickets,
            "delivery": delivery,
            # What each earlier phase recorded, for the phase buttons in the page.
            "history": phase_state.read_archived(repo_path, number, PHASES[: PHASES.index(phase)]),
        }
        if tickets_note:
            detail["ticketsNote"] = tickets_note
        if tickets_error:
            detail["ticketsError"] = tickets_error
        return detail

    # -- endpoints --------------------------------------------------------

    def list(self):
        initiatives, errors = [], []
        for entry in self.storage.get_config()["repos"]:
            repo = entry.get("slug")
            try:
                found = [
                    self._summary(repo, issue, parse_body(issue.get("body")))
                    for issue in self.gh.list_issues(repo, INITIATIVE_LABEL)
                ]
            except KipoError as e:
                errors.append({"repo": repo, "error": e.message, "code": e.code})
                continue
            counts = {}
            if any(i["phase"] in TICKET_PHASES for i in found):
                try:
                    counts = self._stage_counts(repo)
                except KipoError as e:
                    errors.append({"repo": repo, "error": e.message, "code": e.code})
            for i in found:
                i["ticketsByStage"] = (
                    {s: counts.get(i["number"], {}).get(s, 0) for s in STAGES} if i["phase"] in TICKET_PHASES else None
                )
            initiatives += found
        initiatives.sort(key=lambda i: i["updatedAt"], reverse=True)
        result = {"initiatives": initiatives}
        if errors:
            result["errors"] = errors
        return result

    STAGE_COUNT_PAGES = 5

    def _stage_counts(self, repo):
        """``{initiative number: {stage: count}}`` from one query over every staged ticket.

        GitHub's ``labels`` filter matches any of the labels, so one query (paged)
        finds every ticket with a ``stage:`` label in the repo.
        """
        owner, name = repo.split("/", 1)
        query = _STAGED_QUERY.replace("LABELS", json.dumps([f"stage:{s}" for s in STAGES]))
        counts, cursor = {}, None
        for _ in range(self.STAGE_COUNT_PAGES):
            variables = {"owner": owner, "name": name}
            if cursor:
                variables["cursor"] = cursor
            data = self.gh.graphql(query, **variables)
            issues = ((((data or {}).get("data") or {}).get("repository") or {}).get("issues") or {})
            for node in issues.get("nodes") or []:
                labels = [l["name"] for l in (node.get("labels") or {}).get("nodes") or []]
                stage = stage_from_labels(labels)
                for value in _label_values(labels, "kipo:"):
                    if value.isdigit() and stage:
                        per = counts.setdefault(int(value), {})
                        per[stage] = per.get(stage, 0) + 1
            page = issues.get("pageInfo") or {}
            if not page.get("hasNextPage") or not page.get("endCursor"):
                break
            cursor = page["endCursor"]
        return counts

    def create(self, repo, title, destination, size=None, worktree=False):
        validate_repo_slug(repo)
        if not isinstance(destination, str) or not destination.strip():
            raise KipoError("Say what you want to do first.", "invalid_request", 400)
        if not isinstance(title, str) or not title.strip():
            title = title_from(destination)
        if size is not None and size not in SIZES:
            raise KipoError(f"{size!r} is not a KiPo size.", "invalid_size", 400)
        path = self._configured_path(repo)
        body = {
            "destination": destination.strip(),
            # Intake sharpens the Destination; the human's own words stay here.
            "request": destination.strip(),
            "artifacts": [],
            "phaseLog": [f"{self.clock()} created in {PHASES[0]}"],
            "meta": {**default_meta(), "repoPath": path, "size": size},
        }
        labels = [INITIATIVE_LABEL, f"phase:{PHASES[0]}"] + ([f"size:{size}"] if size else [])
        for label in labels:
            self.gh.ensure_label(repo, label)
        number = self.gh.create_issue(repo, title.strip(), render_body(body), labels)
        if worktree:
            # The issue number names the worktree, so it is made after the issue.
            wt_path = f"{path.rstrip(os.sep)}-lp{number}"
            self.gh.add_worktree(path, wt_path, f"kipo/{number}")
            body["meta"]["repoPath"] = wt_path
            body["phaseLog"].append(f"{self.clock()} worktree {wt_path} on branch kipo/{number}")
            self.gh.edit_issue(repo, number, body=render_body(body))
        issue, parsed = self._fetch(repo, number)
        return self._summary(repo, issue, parsed)

    def detail(self, repo, number):
        issue, body = self._fetch(repo, number)
        return self._detail(repo, issue, body)

    def advance(self, repo, number, force=False):
        issue, body = self._fetch(repo, number)
        if (issue.get("state") or "OPEN").upper() != "OPEN":
            raise KipoError(f"Issue #{number} is closed.", "initiative_closed", 409)
        labels = label_names(issue)
        phase = phase_from_labels(labels)
        meta = body["meta"]
        repo_path = self._repo_path(repo, meta)
        st = phase_state.read_state(repo_path, number)

        if phase == "delivery":
            current = self._detail(repo, issue, body)
            gate = current["delivery"]
            if not gate["canAdvance"] and not force:
                raise KipoError(
                    f"{gate['reason']} Finish them, or use Skip.",
                    "gate_not_passed",
                    409,
                    extra={"reason": gate["reason"]},
                )
            target = "release" if (current["ship"] or "together") == "together" else "operate"
        else:
            if not phase_state.gate_passed(st) and not force:
                raise KipoError(
                    f"The {phase} checklist isn't finished yet. Finish it, or use Skip.",
                    "gate_not_passed",
                    409,
                )
            target = next_phase(phase)

        add, remove = [], []
        if target:
            add.append(f"phase:{target}")
            remove += [l for l in labels if l.startswith("phase:") and l != f"phase:{target}"]

        size = (st or {}).get("size")
        if size in SIZES:
            meta["size"] = size
            add.append(f"size:{size}")
            remove += [l for l in labels if l.startswith("size:") and l != f"size:{size}"]

        if target == "delivery":
            meta["ship"] = ship_mode((st or {}).get("ship")) or ship_mode(meta.get("ship")) or "together"

        body["artifacts"] = merge_artifacts(body["artifacts"], phase_state.state_artifacts(st))
        meta.update(derive_meta(meta, body["artifacts"]))
        body["phaseLog"].append(f"{self.clock()} {phase} → {target or 'closed'}")

        for label in add:
            self.gh.ensure_label(repo, label)
        self.gh.edit_issue(repo, number, body=render_body(body), add_labels=add, remove_labels=remove)
        if repo_path:
            phase_state.archive_state(repo_path, number, phase)

        if target == "delivery":
            self._enter_delivery(repo, issue, body)
        elif phase == "release" and target == "operate":
            nodes, _ = self._ticket_nodes(repo, number)
            self._set_stages(repo, [(n, "shipped") for n in nodes if stage_from_labels(n["labels"]) == "ready"])
        if target is None:
            self.gh.close_issue(repo, number)

        issue, body = self._fetch(repo, number)
        return self._detail(repo, issue, body)

    def _enter_delivery(self, repo, issue, body):
        """Label every stage-less open ticket ``stage:build``; with no tickets, file one."""
        number = issue["number"]
        nodes, _ = self._ticket_nodes(repo, number)
        if nodes:
            self._label_stageless(repo, nodes, STAGES[0])
            return
        labels = [f"kipo:{number}", f"stage:{STAGES[0]}"]
        for label in labels:
            self.gh.ensure_label(repo, label)
        text = "\n".join([
            f"Part of KiPo initiative #{number} ({issue['url']}).",
            "",
            "## Destination",
            "",
            body["destination"],
        ])
        self.gh.create_issue(repo, issue["title"], text, labels)

    def remove(self, repo, number):
        """Take an initiative off the board by closing its issue as not planned.

        Nothing is deleted: the issue, its comments and any worktree stay, and
        reopening the issue on GitHub puts it back on the board.
        """
        issue, body = self._fetch(repo, number)
        if (issue.get("state") or "OPEN").upper() == "OPEN":
            phase = phase_from_labels(label_names(issue))
            self.gh.close_issue(
                repo,
                number,
                reason="not planned",
                comment=f"Removed from the KiPo board during {phase}. Reopen this issue to bring it back.",
            )
        return {"removed": True, "repo": repo, "number": number}

    def session(self, repo, number, phase=None, ticket=None):
        issue, body = self._fetch(repo, number)
        summary = self._summary(repo, issue, body)
        phase = phase or summary["phase"]
        if phase not in PHASES:
            raise KipoError(f"{phase!r} is not a KiPo phase.", "invalid_phase", 400)
        if phase == "delivery":
            raise KipoError(
                "Delivery has no session of its own. Start a session on one of its tickets.",
                "invalid_phase",
                400,
            )
        if ticket is not None:
            if isinstance(ticket, bool) or not str(ticket).isdigit() or int(ticket) <= 0:
                raise KipoError("The ticket must be an issue number.", "invalid_ticket", 400)
            ticket = int(ticket)
        repo_path = self._repo_path(repo, body["meta"]) or ""
        slot = session_name(repo, number, phase, ticket)
        self.storage.record_session(repo, number, session_key(phase, ticket), slot)
        ship = ship_mode(body["meta"].get("ship"))
        return {"slotName": slot, "seed": render_seed(summary, repo_path, phase, ticket, ship=ship)}

    def _find_ticket(self, detail, ticket):
        if isinstance(ticket, bool) or not str(ticket).isdigit():
            raise KipoError("The ticket must be an issue number.", "invalid_ticket", 400)
        found = next((t for t in detail["tickets"] if t["number"] == int(ticket)), None)
        if not found:
            if detail.get("ticketsError"):
                raise KipoError(f"Couldn't read the tickets: {detail['ticketsError']}", "gh_failed", 502)
            raise KipoError(
                f"Issue #{ticket} is not a ticket of initiative #{detail['number']}.", "not_ticket", 404
            )
        return found

    @staticmethod
    def _not_active(ticket):
        t, stage = ticket["number"], ticket["stage"]
        if stage is None:
            why = f"Ticket #{t} isn't in delivery yet."
        elif stage == "ready":
            why = f"Ticket #{t} is ready and ships with the rest of the initiative."
        else:
            why = f"Ticket #{t} has shipped."
        return KipoError(why, "ticket_not_active", 409)

    def ticket_session(self, repo, number, ticket):
        issue, body = self._fetch(repo, number)
        detail = self._detail(repo, issue, body)
        found = self._find_ticket(detail, ticket)
        ship = detail["ship"] or "together"
        stage = ticket_session_stage(found["stage"], ship)
        if stage is None:
            raise self._not_active(found)
        if stage == "build" and found["blockedBy"]:
            blockers = ", ".join(f"#{b}" for b in found["blockedBy"])
            raise KipoError(
                f"Ticket #{found['number']} is blocked by {blockers}. Its build can start once they are ready or closed.",
                "ticket_blocked",
                409,
                extra={"blockedBy": found["blockedBy"]},
            )
        repo_path = detail["repoPath"]
        slot = ticket_session_name(repo, number, found["number"], stage)
        self.storage.record_session(repo, number, ticket_session_key(found["number"], stage), slot)
        return {
            "slotName": slot,
            "seed": render_ticket_seed(detail, repo_path, stage, found, ship=detail["ship"]),
        }

    def ticket_advance(self, repo, number, ticket, force=False):
        issue, body = self._fetch(repo, number)
        detail = self._detail(repo, issue, body)
        found = self._find_ticket(detail, ticket)
        ship = detail["ship"] or "together"
        target = next_stage(found["stage"], ship)
        if target is None:
            raise self._not_active(found)
        if not found["gatePassed"] and not force:
            session_stage = ticket_session_stage(found["stage"], ship)
            raise KipoError(
                f"The {session_stage} checklist for ticket #{found['number']} isn't finished yet. Finish it, or use Skip.",
                "gate_not_passed",
                409,
            )
        node = {"number": found["number"], "labels": list(found["labels"])}
        self._set_stage(repo, node, target)
        if detail["repoPath"]:
            phase_state.archive_ticket_state(
                detail["repoPath"], number, found["number"], ticket_session_stage(found["stage"], ship)
            )
        issue, body = self._fetch(repo, number)
        return self._detail(repo, issue, body)

    def doc(self, repo, number, href):
        issue, body = self._fetch(repo, number)
        repo_path = self._repo_path(repo, body["meta"])
        return docs.read_doc(self.gh, repo, repo_path, href)

    def frontier(self, repo, number):
        """Open, unblocked, unassigned children of the wayfinder map (Discovery only).

        Delivery tickets are in the detail's ``tickets`` instead.
        """
        issue, body = self._fetch(repo, number)
        # The map is usually charted mid-Discovery, before advance writes it into
        # the meta comment, so read it through the same derivation the detail uses.
        artifacts = merge_artifacts(
            body["artifacts"],
            phase_state.state_artifacts(phase_state.read_state(self._repo_path(repo, body["meta"]), number)),
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


# Phases in which an initiative's tickets carry stages.
TICKET_PHASES = ("delivery", "release", "operate")

_BLOCKED_FIELD = "blockedBy(first: 50) { nodes { state } }"
_FRONTIER_QUERY = (
    "query($owner: String!, $name: String!, $number: Int!) {"
    " repository(owner: $owner, name: $name) { issue(number: $number) {"
    " subIssues(first: 100) { nodes { number title url state"
    " assignees(first: 1) { totalCount } labels(first: 50) { nodes { name } } BLOCKED } } } } }"
)

_TICKET_BLOCKED_FIELD = "blockedBy(first: 50) { nodes { number state } }"
# LABELS is replaced with a JSON list literal; GitHub's labels filter matches any of them.
_TICKETS_QUERY = (
    "query($owner: String!, $name: String!) {"
    " repository(owner: $owner, name: $name) {"
    " issues(first: 100, labels: LABELS, states: [OPEN, CLOSED], orderBy: {field: CREATED_AT, direction: ASC}) {"
    " nodes { number title url state labels(first: 50) { nodes { name } } BLOCKED } } } }"
)
_STAGED_QUERY = (
    "query($owner: String!, $name: String!, $cursor: String) {"
    " repository(owner: $owner, name: $name) {"
    " issues(first: 100, after: $cursor, labels: LABELS, states: [OPEN, CLOSED],"
    " orderBy: {field: UPDATED_AT, direction: DESC}) {"
    " pageInfo { hasNextPage endCursor } nodes { number labels(first: 50) { nodes { name } } } } } }"
)


def _ticket(issue):
    labels = label_names(issue)
    kind = next((l.split(":", 1)[1] for l in labels if l.startswith("wayfinder:")), None)
    return {"number": issue["number"], "title": issue["title"], "url": issue["url"], "labels": labels, "type": kind}
