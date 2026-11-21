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

# Where Matt Pocock's skills are installed: ~/.agents/skills, or $KIPO_SKILLS_DIR.
SKILLS_DIR = os.environ.get("KIPO_SKILLS_DIR") or os.path.join(os.path.expanduser("~"), ".agents", "skills")


def run_line(skill):
    """The message that starts a skill from a button."""
    return (
        f"Run /{skill}: read {SKILLS_DIR}/{skill}/SKILL.md (and any file it links to) "
        "and follow it now, for this effort."
    )


class KipoError(Exception):
    """An error the HTTP layer turns into ``{"error", "code", **extra}`` with a status."""

    def __init__(self, message, code, status=400, extra=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.extra = extra or {}
