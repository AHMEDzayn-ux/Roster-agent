import enum


class UserRole(str, enum.Enum):
    agent = "agent"
    manager = "manager"


class OffDayType(str, enum.Enum):
    fixed = "fixed"
    flexible = "flexible"


class RequestType(str, enum.Enum):
    off_day = "off_day"
    leave_full = "leave_full"
    leave_half = "leave_half"
    leave_multi = "leave_multi"
    shift_change = "shift_change"
    overtime = "overtime"
    other = "other"


class HalfDayPortion(str, enum.Enum):
    first_half = "first_half"
    second_half = "second_half"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    appealed = "appealed"


class SubmittedVia(str, enum.Enum):
    form = "form"
    ai_parsed = "ai_parsed"


class WeeklyCycleStatus(str, enum.Enum):
    open = "open"
    published = "published"
    locked = "locked"


class RosterStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    locked = "locked"


class GeneratedBy(str, enum.Enum):
    solver = "solver"
    manual = "manual"


class AssignmentSource(str, enum.Enum):
    solver = "solver"
    manual_override = "manual_override"


class ConflictSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class AppealStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
