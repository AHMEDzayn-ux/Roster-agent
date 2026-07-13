from datetime import date, time

from pydantic import BaseModel

from app.models.enums import RosterStatus


class PublicAssignmentOut(BaseModel):
    agent_name: str
    date: date
    shift_name: str
    shift_start: time
    shift_end: time
    skill_name: str


class PublicRosterOut(BaseModel):
    week_start_date: date
    status: RosterStatus
    assignments: list[PublicAssignmentOut]
