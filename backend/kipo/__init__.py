"""KiPo backend package: gh wrapper, effort logic, column state, storage.

The columns, start points and skills are specified in CONTRACT.md.
"""
import os

# The seven columns (the ``kipo:col:`` label on the effort issue), in order.
COLUMNS = ("intake", "shape", "grill", "plan", "build", "review", "done")

# Start points and the columns each one walks through.
PATHS = {
    "idea": ("grill", "plan", "build", "review", "done"),
    "small": ("grill", "build", "review", "done"),
    "huge": ("shape", "plan", "build", "review", "done"),
    "issue": ("intake", "build", "review", "done"),
    "bug": ("build", "review", "done"),
}
STARTS = tuple(PATHS)
DEFAULT_START = "idea"

# Skills the human starts from a column's buttons.
BUTTONS = {
    "intake": ("setup-matt-pocock-skills", "ask-matt", "triage", "improve-codebase-architecture"),
    "shape": ("wayfinder", "to-questionnaire", "handoff", "teach"),
    "grill": ("grill-with-docs", "grill-me", "wait-what"),
    "plan": ("to-spec", "to-tickets"),
    "build": ("implement", "implement-spec"),
    "review": (),
    "done": ("retro",),
}

# Skills the agent loads on its own in a column.
CHIPS = {
    "intake": (),
    "shape": ("research", "prototype"),
    "grill": ("grilling", "domain-modeling"),
    "plan": ("codebase-design",),
    "build": ("tdd", "diagnosing-bugs", "wizard"),
    "review": ("code-review", "pr"),
    "done": ("writing-for-agents",),
}

# Every skill KiPo knows (27), in column order.
SKILLS = tuple(dict.fromkeys(s for c in COLUMNS for s in (*BUTTONS[c], *CHIPS[c])))

# Matt Pocock's skills: the pinned copy bundled in vendor/, or $KIPO_SKILLS_DIR.
APP_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKILLS_DIR = os.path.expanduser(os.environ.get("KIPO_SKILLS_DIR") or "") or os.path.join(
    APP_ROOT, "vendor", "mattpocock-skills"
)


# Under Kiro Crew every shell or MCP call a sub-agent makes is refused, and a
# compound command (``cd x && git …; gh …``) waits on a per-call prompt until
# it times out. So every KiPo session runs one plain command per call and does
# its skills' sub-agent work itself. The seed's Tools line says so.
TOOLS_LINE = (
    "Tools: one plain command per call: `git -C <worktree> <cmd>`, `gh <cmd> -R <owner/repo>`; "
    "no `cd … &&`, no `&&`/`||`/`;` chains, no pipes or redirects, no `$(…)`; "
    "PR bodies and comments go in a file passed with `--body-file`; push as its own call with a literal branch. "
    "No sub-agents: never use the Agent or Task tool; when a skill says to spawn sub-agents, "
    "do that work yourself here, one step after another."
)

# Matt's skills that fan out into sub-agents, and what to do inline instead.
INLINE = {
    "code-review": "run the Standards axis, then the Spec axis, yourself in this conversation, "
                   "one after the other, finishing one axis's report before starting the next",
    "implement-spec": "implement the ready tickets yourself in this conversation, one after another, "
                      "and run its code review inline (Standards axis, then Spec axis)",
    "grilling": "look up the facts yourself between questions",
    "wayfinder": "resolve its research tickets yourself, one after another",
    "improve-codebase-architecture": "walk the codebase yourself",
    "codebase-design": "draft the alternative interfaces yourself, one after another",
}


def run_line(skill):
    """The message that starts a skill from a button."""
    line = (
        f"Run /{skill}: read {SKILLS_DIR}/{skill}/SKILL.md (and any file it links to) "
        "and follow it now, for this effort."
    )
    if skill in INLINE:
        line += (" It says to use sub-agents: don't (no Agent or Task tool, no parallel fan-out); "
                 f"{INLINE[skill]}.")
    return line


class KipoError(Exception):
    """An error the HTTP layer turns into ``{"error", "code", **extra}`` with a status."""

    def __init__(self, message, code, status=400, extra=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.extra = extra or {}
