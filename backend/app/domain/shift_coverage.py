"""Shift/time-slot overlap logic shared by the solver and Excel-import
re-validation — both need to answer "does this shift cover this coverage
requirement's time slot", including overnight-wrapping shifts (e.g. 21:00-06:00)."""
from datetime import time

MIDNIGHT = time(0, 0)
END_OF_DAY = time(23, 59, 59)


def shift_intervals(start: time, end: time) -> list[tuple[time, time]]:
    if end == MIDNIGHT:
        return [(start, END_OF_DAY)]
    if end > start:
        return [(start, end)]
    return [(start, END_OF_DAY), (MIDNIGHT, end)]


def intervals_overlap(a_start: time, a_end: time, b_start: time, b_end: time) -> bool:
    return a_start < b_end and b_start < a_end


def shift_covers_slot(shift_start: time, shift_end: time, slot_start: time, slot_end: time) -> bool:
    return any(
        intervals_overlap(s, e, slot_start, slot_end) for s, e in shift_intervals(shift_start, shift_end)
    )
