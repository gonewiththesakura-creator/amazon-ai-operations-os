from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


@dataclass(frozen=True, slots=True)
class BusinessClock:
    timezone_name: str = "America/Los_Angeles"
    logical_now: datetime | None = None

    def now_utc(self) -> datetime:
        value = self.logical_now or datetime.now(timezone.utc)
        if value.tzinfo is None:
            raise ValueError("logical_now must be timezone-aware")
        return value.astimezone(timezone.utc)

    def current_business_date(self) -> date:
        return self.now_utc().astimezone(ZoneInfo(self.timezone_name)).date()

    def business_day_period(self, business_date: date) -> tuple[datetime, datetime]:
        zone = ZoneInfo(self.timezone_name)
        start_local = datetime.combine(business_date, time.min, zone)
        end_local = start_local + timedelta(days=1) - timedelta(microseconds=1)
        return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)

