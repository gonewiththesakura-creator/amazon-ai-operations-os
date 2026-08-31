from datetime import datetime, timezone

from amazon_ai_api.services.business_clock import BusinessClock


def test_business_date_uses_los_angeles_timezone() -> None:
    before_la_midnight = BusinessClock(
        logical_now=datetime(2026, 8, 31, 6, 59, tzinfo=timezone.utc)
    )
    after_la_midnight = BusinessClock(
        logical_now=datetime(2026, 8, 31, 7, 0, tzinfo=timezone.utc)
    )

    assert before_la_midnight.current_business_date().isoformat() == "2026-08-30"
    assert after_la_midnight.current_business_date().isoformat() == "2026-08-31"
    start, end = after_la_midnight.business_day_period(after_la_midnight.current_business_date())
    assert start.isoformat() == "2026-08-31T07:00:00+00:00"
    assert end.isoformat() == "2026-09-01T06:59:59.999999+00:00"

