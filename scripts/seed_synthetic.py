#!/usr/bin/env python3
"""Generate deterministic synthetic fixtures for the Amazon AI operations OS.

The generator intentionally performs no network calls and does not require a
database driver. Output is newline-delimited JSON so the future SyntheticAdapter
can ingest it through the same raw -> validation -> core pipeline as live data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import uuid
from contextlib import ExitStack
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping


GENERATOR_VERSION = "1.0.0"
DEFAULT_SEED = 20260831
LOGICAL_TODAY = date(2026, 8, 31)
TENANT_ID = "00000000-0000-0000-0000-000000000001"
ACCOUNT_ID = "00000000-0000-0000-0000-000000000101"
MARKETPLACE = "US"
BUSINESS_TIMEZONE = "America/Los_Angeles"
CURRENCY = "USD"
SCENARIO_ID = "us_demo_v1"
NAMESPACE = uuid.UUID("9a44d926-1cb4-53c8-90d9-c3f0943abf00")

EXPECTED_COUNTS = {
    "products": 20,
    "product_stage_history": 20,
    "sales_traffic_daily": 20 * 365,
    "market_niches": 30,
    "product_opportunities": 30,
    "market_niche_snapshots": 3_000,
    "keyword_signals": 20_000,
    "customer_pain_points": 10_000,
    "creative_signals": 500,
    "candidate_products": 100,
    "suppliers": 10,
    "supplier_quotes": 20,
    "product_cost_scenarios": 30,
}

EXACT_DOMAIN_TABLES = (
    "market_niches", "market_niche_snapshots", "product_opportunities", "opportunity_evidence",
    "public_market_observations", "creative_signals", "candidate_products", "candidate_product_snapshots",
    "candidate_evaluations", "candidate_score_versions", "candidate_score_dimensions", "candidate_risks",
    "candidate_differentiation_ideas", "candidate_research_tasks", "candidate_project_stage_history",
    "candidate_rejection_reasons", "suppliers", "supplier_contacts", "supplier_products", "supplier_quotes",
    "contracts", "purchase_orders", "purchase_order_items", "supplier_payments", "payment_allocations",
    "logistics_shipments", "logistics_shipment_items", "inventory_batches", "landed_cost_allocations",
    "customs_costs", "freight_costs", "packaging_costs", "document_entity_links", "sample_orders",
    "sample_evaluations", "product_cost_scenarios",
)

PROVENANCE_FIELDS = {
    "source",
    "source_kind",
    "semantic_source_kind",
    "collected_at",
    "data_period",
    "marketplace",
    "timezone",
    "currency",
    "grain",
    "attribution_window",
    "is_estimated",
    "confidence",
    "limitations",
    "raw_record_reference",
    "synthetic",
    "scenario_id",
}

FORBIDDEN_PII_KEYS = {
    "buyer_name",
    "buyer_address",
    "buyer_email",
    "buyer_phone",
    "shipping_address",
}


def stable_uuid(entity: str, index: int | str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{SCENARIO_ID}:{entity}:{index}"))


def stable_fraction(*parts: object) -> float:
    digest = hashlib.sha256(":".join(str(part) for part in parts).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float(2**64 - 1)


def bounded_value(low: float, high: float, *parts: object) -> float:
    return low + (high - low) * stable_fraction(*parts)


def iso_midnight(day: date) -> str:
    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def provenance(
    dataset: str,
    row_key: str,
    *,
    semantic_source_kind: str,
    grain: str,
    period_start: date,
    period_end: date | None = None,
    is_estimated: bool,
    confidence: float,
    source_suffix: str,
    limitations: list[str] | None = None,
) -> dict[str, Any]:
    end = period_end or period_start
    return {
        "source": f"synthetic:{source_suffix}",
        "source_kind": "SYNTHETIC",
        "semantic_source_kind": semantic_source_kind,
        "collected_at": "2026-08-31T12:00:00Z",
        "data_period": {"start": iso_midnight(period_start), "end": iso_midnight(end)},
        "marketplace": MARKETPLACE,
        "timezone": BUSINESS_TIMEZONE,
        "currency": CURRENCY,
        "grain": grain,
        "attribution_window": "NOT_APPLICABLE",
        "is_estimated": is_estimated,
        "confidence": round(confidence, 4),
        "limitations": limitations or [],
        "raw_record_reference": f"synthetic://{SCENARIO_ID}/{dataset}/{row_key}",
        "synthetic": True,
        "scenario_id": SCENARIO_ID,
    }


def with_provenance(
    record: dict[str, Any],
    dataset: str,
    row_key: str,
    **provenance_args: Any,
) -> dict[str, Any]:
    record.update(provenance(dataset, row_key, **provenance_args))
    return record


def product_records() -> Iterator[dict[str, Any]]:
    categories = ["Home Organization", "Kitchen Accessories", "Desk Accessories", "Travel Accessories"]
    for index in range(1, 21):
        asin = f"SYN-ASIN-{index:03d}"
        yield with_provenance(
            {
                "product_id": stable_uuid("product", index),
                "tenant_id": TENANT_ID,
                "account_id": ACCOUNT_ID,
                "asin": asin,
                "title": f"Synthetic Durable Product {index:02d}",
                "brand": "Northstar Demo",
                "category": categories[(index - 1) % len(categories)],
                "lifecycle_status": "ACTIVE",
            },
            "products",
            asin,
            semantic_source_kind="FIRST_PARTY",
            grain="ASIN",
            period_start=LOGICAL_TODAY,
            is_estimated=False,
            confidence=1.0,
            source_suffix="amazon_sp_api",
        )


def stage_records() -> Iterator[dict[str, Any]]:
    stages = ["LAUNCH", "SCALE", "HARVEST", "RECOVERY"]
    for index in range(1, 21):
        effective_stage = stages[(index - 1) // 5]
        yield with_provenance(
            {
                "stage_history_id": stable_uuid("product-stage", index),
                "tenant_id": TENANT_ID,
                "product_id": stable_uuid("product", index),
                "recommended_stage": effective_stage,
                "effective_stage": effective_stage,
                "stage_confidence": round(bounded_value(0.72, 0.96, "stage", index), 4),
                "stage_reasons": [f"fixture_stage_cohort_{effective_stage.lower()}", "user_confirmed_demo_fact"],
                "manual_override": False,
                "override_reason": None,
                "locked_by_user": True,
                "confirmed_by_user_id": stable_uuid("user", 1),
                "confirmed_at": "2026-01-01T09:00:00Z",
                "effective_from": "2026-01-01T00:00:00Z",
                "effective_to": None,
            },
            "product_stage_history",
            str(index),
            semantic_source_kind="USER_PROVIDED",
            grain="ASIN_STAGE_EFFECTIVE_PERIOD",
            period_start=date(2026, 1, 1),
            period_end=LOGICAL_TODAY,
            is_estimated=False,
            confidence=1.0,
            source_suffix="user_confirmation",
        )


def sales_records() -> Iterator[dict[str, Any]]:
    start = LOGICAL_TODAY - timedelta(days=364)
    for product_index in range(1, 21):
        phase = (product_index - 1) // 5
        unit_price = 21.99 + (product_index % 7) * 3.50
        base_sessions = 42 + product_index * 5
        base_cvr = [0.075, 0.145, 0.185, 0.105][phase]
        for day_offset in range(365):
            business_day = start + timedelta(days=day_offset)
            weekly = 1.0 + 0.09 * math.sin((2 * math.pi * business_day.weekday()) / 7)
            trend = [0.75 + day_offset / 900, 0.95 + day_offset / 1800, 1.08, 1.16 - day_offset / 2600][phase]
            noise = bounded_value(0.86, 1.14, "sales", product_index, day_offset)
            sessions = max(0, int(round(base_sessions * weekly * trend * noise)))
            cvr_noise = bounded_value(0.88, 1.12, "cvr", product_index, day_offset)
            orders = max(0, int(round(sessions * base_cvr * cvr_noise)))
            if product_index == 20 and day_offset >= 360:
                sessions, orders = 0, 0
            units = orders + (1 if orders > 3 and stable_fraction("multi", product_index, day_offset) > 0.82 else 0)
            row_key = f"SYN-ASIN-{product_index:03d}:{business_day.isoformat()}"
            yield with_provenance(
                {
                    "sales_traffic_id": stable_uuid("sales-daily", f"{product_index}:{business_day}"),
                    "tenant_id": TENANT_ID,
                    "account_id": ACCOUNT_ID,
                    "product_id": stable_uuid("product", product_index),
                    "asin": f"SYN-ASIN-{product_index:03d}",
                    "business_date": business_day.isoformat(),
                    "ordered_product_sales": round(units * unit_price, 2),
                    "units_ordered": units,
                    "orders": orders,
                    "sessions": sessions,
                    "page_views": int(round(sessions * bounded_value(1.08, 1.36, "pv", product_index, day_offset))),
                    "buy_box_percentage": round(bounded_value(0.91, 1.0, "bb", product_index, day_offset), 4),
                    "maturity": "MATURED" if business_day < LOGICAL_TODAY else "PROVISIONAL",
                },
                "sales_traffic_daily",
                row_key,
                semantic_source_kind="FIRST_PARTY",
                grain="ASIN_DAY",
                period_start=business_day,
                is_estimated=False,
                confidence=1.0,
                source_suffix="amazon_sp_api",
            )


def market_niche_records() -> Iterator[dict[str, Any]]:
    for index in range(1, 31):
        key = f"SYN-MARKET-{index:03d}"
        low = bounded_value(18, 44, "niche-low", index)
        yield with_provenance(
            {
                "market_niche_id": stable_uuid("market-niche", index),
                "tenant_id": TENANT_ID,
                "normalized_name": key.lower(),
                "display_name": f"Synthetic Durable Niche {index:02d}",
                "category_path": f"Synthetic Durable Goods / Segment {(index - 1) % 6 + 1}",
                "price_band_low": round(low, 2),
                "price_band_high": round(low + bounded_value(8, 32, "niche-high", index), 2),
                "status": ["DISCOVERED", "WATCHING", "QUALIFIED"][index % 3],
            },
            "market_niches",
            key,
            semantic_source_kind="THIRD_PARTY_ESTIMATE",
            grain="MARKET_NICHE",
            period_start=LOGICAL_TODAY - timedelta(days=30),
            period_end=LOGICAL_TODAY,
            is_estimated=True,
            confidence=bounded_value(0.58, 0.88, "opp-confidence", index),
            source_suffix="opportunity_model",
            limitations=["Synthetic opportunity model", "Requires supplier and compliance validation"],
        )


def product_opportunity_records() -> Iterator[dict[str, Any]]:
    for index in range(1, 31):
        key = f"SYN-OPP-{index:03d}"
        yield with_provenance(
            {
                "product_opportunity_id": stable_uuid("opportunity", index),
                "tenant_id": TENANT_ID,
                "market_niche_id": stable_uuid("market-niche", index),
                "opportunity_code": key,
                "title": f"Synthetic Product Opportunity {index:02d}",
                "hypothesis": "Demand appears durable, but supplier and compliance evidence remains to be validated.",
                "status": ["DISCOVERED", "WATCHING", "QUALIFIED"][index % 3],
                "first_detected_at": "2026-08-01T00:00:00Z",
                "last_detected_at": "2026-08-31T00:00:00Z",
            },
            "product_opportunities",
            key,
            semantic_source_kind="AI_INFERENCE",
            grain="PRODUCT_OPPORTUNITY",
            period_start=LOGICAL_TODAY - timedelta(days=30),
            period_end=LOGICAL_TODAY,
            is_estimated=True,
            confidence=bounded_value(0.58, 0.88, "opp-confidence", index),
            source_suffix="opportunity_model",
            limitations=["Synthetic opportunity model", "Requires supplier and compliance validation"],
        )


def market_niche_snapshot_records() -> Iterator[dict[str, Any]]:
    for index in range(3_000):
        opportunity_index = index % 30 + 1
        snapshot_index = index // 30
        observed_day = LOGICAL_TODAY - timedelta(days=99 - snapshot_index)
        median_price = bounded_value(18, 68, "market-price", opportunity_index, snapshot_index)
        row_key = f"{opportunity_index}:{observed_day.isoformat()}"
        yield with_provenance(
            {
                "market_niche_snapshot_id": stable_uuid("market-niche-snapshot", index),
                "tenant_id": TENANT_ID,
                "market_niche_id": stable_uuid("market-niche", opportunity_index),
                "observed_at": iso_midnight(observed_day),
                "active_listing_count": int(bounded_value(45, 460, "listing-count", opportunity_index, snapshot_index)),
                "median_price": round(median_price, 2),
                "median_rating": round(bounded_value(3.7, 4.7, "rating", opportunity_index, snapshot_index), 3),
                "median_review_count": int(bounded_value(80, 4_600, "reviews", opportunity_index, snapshot_index)),
                "estimated_monthly_units": round(bounded_value(1_200, 32_000, "market-units", opportunity_index, snapshot_index), 2),
                "estimated_monthly_revenue": round(bounded_value(1_200, 32_000, "market-units", opportunity_index, snapshot_index) * median_price, 2),
                "methodology_version": "synthetic-market-v1",
            },
            "market_niche_snapshots",
            row_key,
            semantic_source_kind="THIRD_PARTY_ESTIMATE",
            grain="MARKET_DAY",
            period_start=observed_day,
            is_estimated=True,
            confidence=bounded_value(0.52, 0.84, "market-confidence", opportunity_index, snapshot_index),
            source_suffix="seller_sprite",
            limitations=["Third-party estimate semantics", "Not Amazon first-party sales"],
        )


def keyword_signal_records() -> Iterator[dict[str, Any]]:
    period_start = LOGICAL_TODAY - timedelta(days=29)
    for index in range(1, 20_001):
        opportunity_index = (index - 1) % 30 + 1
        keyword = f"synthetic use case {opportunity_index:02d} modifier {index:05d}"
        yield with_provenance(
            {
                "keyword_signal_id": stable_uuid("keyword-signal", index),
                "tenant_id": TENANT_ID,
                "product_opportunity_id": stable_uuid("opportunity", opportunity_index),
                "keyword_text": keyword,
                "normalized_keyword": keyword,
                "language": "en-US",
                "period_start": period_start.isoformat(),
                "period_end": LOGICAL_TODAY.isoformat(),
                "estimated_search_volume": int(bounded_value(40, 48_000, "search-volume", index)),
                "trend_index": round(bounded_value(62, 168, "trend", index), 4),
                "suggested_bid_low": round(bounded_value(0.31, 1.72, "bid-low", index), 2),
                "suggested_bid_high": round(bounded_value(1.75, 4.80, "bid-high", index), 2),
            },
            "keyword_signals",
            str(index),
            semantic_source_kind="THIRD_PARTY_ESTIMATE",
            grain="KEYWORD_30_DAY",
            period_start=period_start,
            period_end=LOGICAL_TODAY,
            is_estimated=True,
            confidence=bounded_value(0.5, 0.82, "keyword-confidence", index),
            source_suffix="seller_sprite",
            limitations=["Search volume is an estimate"],
        )


def pain_point_records() -> Iterator[dict[str, Any]]:
    period_start = LOGICAL_TODAY - timedelta(days=89)
    labels = ["Difficult cleaning", "Weak durability", "Unclear sizing", "Awkward storage", "Missing instructions"]
    for index in range(1, 10_001):
        opportunity_index = (index - 1) % 30 + 1
        label = labels[(index - 1) % len(labels)]
        yield with_provenance(
            {
                "pain_point_id": stable_uuid("pain-point", index),
                "tenant_id": TENANT_ID,
                "product_opportunity_id": stable_uuid("opportunity", opportunity_index),
                "pain_code": f"SYN-PAIN-{(index - 1) % 50 + 1:03d}",
                "pain_label": label,
                "feedback_type": ["REVIEW", "RETURN", "Q_AND_A", "SOCIAL"][index % 4],
                "period_start": period_start.isoformat(),
                "period_end": LOGICAL_TODAY.isoformat(),
                "mention_count": int(bounded_value(1, 180, "mentions", index)),
                "sentiment": round(bounded_value(-0.96, -0.08, "sentiment", index), 4),
                "evidence_excerpt": f"Synthetic aggregate excerpt describing {label.lower()}.",
                "evidence_reference": f"synthetic-feedback-bucket-{index:05d}",
                "model_version": "synthetic-theme-v1",
            },
            "customer_pain_points",
            str(index),
            semantic_source_kind="AI_INFERENCE",
            grain="PAIN_POINT_90_DAY",
            period_start=period_start,
            period_end=LOGICAL_TODAY,
            is_estimated=True,
            confidence=bounded_value(0.56, 0.94, "pain-confidence", index),
            source_suffix="feedback_theme_model",
            limitations=["Aggregate synthetic theme; contains no buyer PII"],
        )


def creative_signal_records() -> Iterator[dict[str, Any]]:
    for index in range(1, 501):
        opportunity_index = (index - 1) % 30 + 1
        observed_day = LOGICAL_TODAY - timedelta(days=index % 45)
        platform = "TIKTOK" if index % 2 else "YOUTUBE"
        yield with_provenance(
            {
                "creative_signal_id": stable_uuid("creative-signal", index),
                "tenant_id": TENANT_ID,
                "product_opportunity_id": stable_uuid("opportunity", opportunity_index),
                "platform": platform,
                "public_url": f"https://example.invalid/synthetic-creative/{index}",
                "observed_at": iso_midnight(observed_day),
                "creative_angle": f"Synthetic problem-solution angle {(index - 1) % 20 + 1}",
                "hook_pattern": "Show the frustrating before-state, then demonstrate the mechanism.",
                "engagement_metric_name": "PUBLIC_ENGAGEMENT_INDEX",
                "engagement_metric_value": round(bounded_value(18, 98, "creative", index), 4),
                "license_use": "REFERENCE_ONLY",
                "demand_signal_only": True,
            },
            "creative_signals",
            str(index),
            semantic_source_kind="PUBLIC_OBSERVATION",
            grain="PUBLIC_CONTENT_OBSERVATION",
            period_start=observed_day,
            is_estimated=False,
            confidence=bounded_value(0.45, 0.79, "creative-confidence", index),
            source_suffix="public_web",
            limitations=["Not attributable to Amazon orders", "Reference-only synthetic URL"],
        )


def candidate_records() -> Iterator[dict[str, Any]]:
    stages = ["DISCOVERED", "PRELIMINARY_RESEARCH", "DEEP_VALIDATION", "PENDING_APPROVAL", "SUPPLIER_SEARCH", "SAMPLING", "COST_CONFIRMED", "REJECTED"]
    for index in range(1, 101):
        stage = stages[(index - 1) % len(stages)]
        opportunity_index = (index - 1) % 30 + 1
        low = bounded_value(18, 42, "candidate-low", index)
        yield with_provenance(
            {
                "candidate_product_id": stable_uuid("candidate", index),
                "tenant_id": TENANT_ID,
                "product_opportunity_id": stable_uuid("opportunity", opportunity_index),
                "market_niche_id": stable_uuid("market-niche", opportunity_index),
                "candidate_code": f"SYN-CAND-{index:03d}",
                "project_name": f"Synthetic Candidate Product {index:03d}",
                "current_stage": stage,
                "active": stage != "REJECTED",
                "concept": {
                    "value_proposition": "Reduce a recurring customer pain with a simpler durable mechanism.",
                    "target_customer": f"Synthetic household segment {(index - 1) % 8 + 1}",
                    "target_price_low": round(low, 2),
                    "target_price_high": round(low + bounded_value(5, 24, "candidate-high", index), 2),
                },
            },
            "candidate_products",
            str(index),
            semantic_source_kind="AI_INFERENCE",
            grain="PRODUCT_CANDIDATE",
            period_start=LOGICAL_TODAY,
            is_estimated=True,
            confidence=bounded_value(0.55, 0.88, "candidate-confidence", index),
            source_suffix="product_opportunity_model",
            limitations=["Candidate economics require confirmed supplier quotation"],
        )


def supplier_records() -> Iterator[dict[str, Any]]:
    for index in range(1, 11):
        yield with_provenance(
            {
                "supplier_id": stable_uuid("supplier", index),
                "tenant_id": TENANT_ID,
                "supplier_key": f"SYN-SUP-{index:03d}",
                "legal_name": f"Synthetic Manufacturing Partner {index:02d} LLC",
                "country_code": ["CN", "VN", "MX", "US"][index % 4],
                "default_currency": "USD",
                "status": "QUALIFIED" if index <= 6 else "PROSPECT",
                "payment_terms": "30% deposit, 70% before shipment",
                "risk_notes": "Synthetic supplier record; no real company or contact data.",
            },
            "suppliers",
            str(index),
            semantic_source_kind="USER_PROVIDED",
            grain="SUPPLIER",
            period_start=LOGICAL_TODAY,
            is_estimated=False,
            confidence=1.0,
            source_suffix="user_upload",
        )


def quotation_records() -> Iterator[dict[str, Any]]:
    for index in range(1, 21):
        quoted_day = LOGICAL_TODAY - timedelta(days=index)
        yield with_provenance(
            {
                "supplier_quote_id": stable_uuid("quotation", index),
                "tenant_id": TENANT_ID,
                "supplier_id": stable_uuid("supplier", (index - 1) % 10 + 1),
                "candidate_product_id": stable_uuid("candidate", index),
                "quotation_number": f"SYN-QUOTE-{index:04d}",
                "quoted_at": quoted_day.isoformat(),
                "valid_until": (quoted_day + timedelta(days=30)).isoformat(),
                "incoterm": ["EXW", "FOB", "DDP"][index % 3],
                "status": "UNDER_REVIEW" if index % 4 else "RECEIVED",
                "moq": int(bounded_value(300, 2_000, "moq", index)),
                "unit_price": round(bounded_value(3.2, 16.8, "quote-price", index), 2),
                "lead_time_days": int(bounded_value(22, 58, "lead", index)),
                "ocr_confirmation_status": "CONFIRMED",
            },
            "supplier_quotes",
            str(index),
            semantic_source_kind="USER_PROVIDED",
            grain="SUPPLIER_QUOTATION",
            period_start=quoted_day,
            is_estimated=False,
            confidence=1.0,
            source_suffix="confirmed_quotation_document",
            limitations=["Synthetic quotation; no real supplier commitment"],
        )


def cost_scenario_records() -> Iterator[dict[str, Any]]:
    types = ["BASE", "UPSIDE", "DOWNSIDE", "SUPPLIER", "PRICE", "FREIGHT"]
    for index in range(1, 31):
        sale_price = bounded_value(24, 72, "sale-price", index)
        product_cost = bounded_value(4, 19, "unit-cost", index)
        fulfillment = bounded_value(4.2, 9.8, "fulfillment", index)
        referral = sale_price * 0.15
        freight = bounded_value(0.8, 4.6, "freight", index)
        contribution = sale_price - product_cost - fulfillment - referral - freight
        completeness = "COMPLETE" if index % 3 else "ESTIMATED"
        yield with_provenance(
            {
                "product_cost_scenario_id": stable_uuid("cost-scenario", index),
                "tenant_id": TENANT_ID,
                "candidate_product_id": stable_uuid("candidate", (index - 1) % 100 + 1),
                "version": 1,
                "quantity": int(bounded_value(300, 2000, "cost-qty", index)),
                "purchase_amount": round(product_cost, 4),
                "freight_amount": round(freight, 4),
                "duty_amount": round(product_cost * 0.08, 4),
                "packaging_amount": round(bounded_value(0.2, 1.8, "packaging", index), 4),
                "other_amount": round(fulfillment + referral, 4),
                "source_currency": "USD",
                "reporting_currency": "USD",
                "fx_assumptions": {"rate": 1.0, "rate_type": "IDENTITY"},
                "unit_landed_cost": round(product_cost + freight + product_cost * 0.08, 4) if completeness == "COMPLETE" else None,
                "contribution_margin": round(contribution, 4),
                "break_even_acos": round(max(0, contribution) / sale_price, 6) if completeness == "COMPLETE" else None,
                "status": completeness,
                "scenario_type": types[(index - 1) % len(types)],
            },
            "product_cost_scenarios",
            str(index),
            semantic_source_kind="AI_INFERENCE" if completeness != "COMPLETE" else "USER_PROVIDED",
            grain="CANDIDATE_COST_SCENARIO",
            period_start=LOGICAL_TODAY,
            is_estimated=completeness != "COMPLETE",
            confidence=0.92 if completeness == "COMPLETE" else 0.64,
            source_suffix="cost_simulator",
            limitations=[] if completeness == "COMPLETE" else ["Freight input remains estimated; break-even ACOS withheld"],
        )


DATASETS: tuple[tuple[str, Any], ...] = (
    ("products", product_records),
    ("product_stage_history", stage_records),
    ("sales_traffic_daily", sales_records),
    ("market_niches", market_niche_records),
    ("product_opportunities", product_opportunity_records),
    ("market_niche_snapshots", market_niche_snapshot_records),
    ("keyword_signals", keyword_signal_records),
    ("customer_pain_points", pain_point_records),
    ("creative_signals", creative_signal_records),
    ("candidate_products", candidate_records),
    ("suppliers", supplier_records),
    ("supplier_quotes", quotation_records),
    ("product_cost_scenarios", cost_scenario_records),
)


def validate_record(dataset: str, record: Mapping[str, Any]) -> None:
    missing = PROVENANCE_FIELDS.difference(record)
    if missing:
        raise ValueError(f"{dataset} record missing provenance fields: {sorted(missing)}")
    if record["synthetic"] is not True or record["source_kind"] != "SYNTHETIC":
        raise ValueError(f"{dataset} contains an unmarked synthetic record")
    if not str(record["source"]).startswith("synthetic:"):
        raise ValueError(f"{dataset} source is not namespaced as synthetic")
    forbidden = FORBIDDEN_PII_KEYS.intersection(record)
    if forbidden:
        raise ValueError(f"{dataset} contains forbidden buyer PII keys: {sorted(forbidden)}")
    confidence = float(record["confidence"])
    if not 0 <= confidence <= 1:
        raise ValueError(f"{dataset} confidence is outside [0, 1]")
    if record["is_estimated"] and record["semantic_source_kind"] not in {
        "THIRD_PARTY_ESTIMATE",
        "AI_INFERENCE",
        "PUBLIC_OBSERVATION",
    }:
        raise ValueError(f"{dataset} estimated record has incompatible semantic source")


@dataclass
class GenerationSummary:
    counts: dict[str, int]
    checksum: str
    output_dir: str | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "scenario_id": SCENARIO_ID,
            "generator_version": GENERATOR_VERSION,
            "seed": DEFAULT_SEED,
            "logical_today": LOGICAL_TODAY.isoformat(),
            "marketplace": MARKETPLACE,
            "business_timezone": BUSINESS_TIMEZONE,
            "currency": CURRENCY,
            "synthetic": True,
            "domain_tables": list(EXACT_DOMAIN_TABLES),
            "counts": self.counts,
            "checksum": self.checksum,
            "output_dir": self.output_dir,
        }


def generate(output_dir: Path | None = None) -> GenerationSummary:
    if output_dir is not None:
        output_dir.mkdir(parents=True, exist_ok=True)

    counts: dict[str, int] = {}
    combined_hash = hashlib.sha256()
    with ExitStack() as stack:
        handles = {
            dataset: stack.enter_context((output_dir / f"{dataset}.ndjson").open("w", encoding="utf-8", newline="\n"))
            for dataset, _ in DATASETS
        } if output_dir is not None else {}

        for dataset, factory in DATASETS:
            dataset_count = 0
            for record in factory():
                validate_record(dataset, record)
                serialized = json.dumps(record, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
                combined_hash.update(dataset.encode("utf-8"))
                combined_hash.update(b"\0")
                combined_hash.update(serialized.encode("utf-8"))
                combined_hash.update(b"\n")
                if output_dir is not None:
                    handles[dataset].write(serialized)
                    handles[dataset].write("\n")
                dataset_count += 1
            counts[dataset] = dataset_count

    for dataset, expected_count in EXPECTED_COUNTS.items():
        actual_count = counts.get(dataset)
        if actual_count != expected_count:
            raise ValueError(f"{dataset}: expected {expected_count:,} records, generated {actual_count!r}")

    summary = GenerationSummary(counts=counts, checksum=combined_hash.hexdigest(), output_dir=str(output_dir) if output_dir else None)
    if output_dir is not None:
        manifest_path = output_dir / "scenario_manifest.json"
        manifest_path.write_text(json.dumps(summary.as_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    output_group = parser.add_mutually_exclusive_group()
    output_group.add_argument("--output-dir", type=Path, help="Write NDJSON datasets and a scenario manifest")
    output_group.add_argument("--validate-only", action="store_true", help="Generate, validate, and checksum without writing files")
    parser.add_argument("--summary-json", action="store_true", help="Print the summary as compact JSON")
    return parser.parse_args(list(argv))


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if not args.output_dir and not args.validate_only:
        print("Specify --validate-only or --output-dir PATH", file=sys.stderr)
        return 2
    summary = generate(args.output_dir)
    if args.summary_json:
        print(json.dumps(summary.as_dict(), sort_keys=True))
    else:
        print(f"Synthetic scenario {SCENARIO_ID} validated: {sum(summary.counts.values()):,} records")
        for dataset, count in summary.counts.items():
            print(f"  {dataset}: {count:,}")
        print(f"  checksum: {summary.checksum}")
        if summary.output_dir:
            print(f"  output: {summary.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
