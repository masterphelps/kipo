"""KiPo backend package: gh wrapper, initiative logic, phase state, storage."""

# Initiative phases (the ``phase:`` label on the initiative issue), in order.
PHASES = (
    "intake",
    "discovery",
    "refinement",
    "design",
    "delivery",
    "release",
    "operate",
)

# Ticket stages (the ``stage:`` label on each ticket issue), in order.
STAGES = ("build", "review", "test", "security", "ready", "shipped")

# Stages that run a session per ticket.
WORK_STAGES = ("build", "review", "test", "security")

# The one-level model's phases that are now read as ``delivery``.
OLD_DELIVERY_PHASES = WORK_STAGES

SHIP_MODES = ("together", "each")

SIZES = ("small", "feature", "foggy", "bug")


class KipoError(Exception):
    """An error the HTTP layer turns into ``{"error", "code", **extra}`` with a status."""

    def __init__(self, message, code, status=400, extra=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.extra = extra or {}
