from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts import seed_synthetic  # noqa: E402


MIGRATION_DIR = ROOT / "infra" / "postgres" / "migrations"


def migration_sql() -> str:
    return "\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted(MIGRATION_DIR.glob("*.sql"))
    )


class SyntheticSeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.first = seed_synthetic.generate()

    def test_required_dataset_sizes(self) -> None:
        for dataset, expected in seed_synthetic.EXPECTED_COUNTS.items():
            self.assertEqual(self.first.counts[dataset], expected, dataset)
        self.assertEqual(sum(self.first.counts.values()), 41_425)

    def test_manifest_declares_the_exact_36_domain_tables(self) -> None:
        self.assertEqual(len(seed_synthetic.EXACT_DOMAIN_TABLES), 36)
        self.assertEqual(len(set(seed_synthetic.EXACT_DOMAIN_TABLES)), 36)
        for dataset in (
            "market_niches",
            "market_niche_snapshots",
            "product_opportunities",
            "candidate_products",
            "supplier_quotes",
            "product_cost_scenarios",
        ):
            self.assertIn(dataset, seed_synthetic.EXACT_DOMAIN_TABLES)
            self.assertIn(dataset, self.first.counts)

    def test_generation_is_deterministic(self) -> None:
        second = seed_synthetic.generate()
        self.assertEqual(self.first.checksum, second.checksum)
        self.assertEqual(self.first.counts, second.counts)

    def test_all_generators_emit_complete_synthetic_provenance(self) -> None:
        for dataset, factory in seed_synthetic.DATASETS:
            for record in factory():
                self.assertTrue(record["synthetic"], dataset)
                self.assertEqual(record["source_kind"], "SYNTHETIC", dataset)
                self.assertTrue(record["source"].startswith("synthetic:"), dataset)
                self.assertFalse(seed_synthetic.PROVENANCE_FIELDS.difference(record), dataset)
                self.assertFalse(seed_synthetic.FORBIDDEN_PII_KEYS.intersection(record), dataset)

    def test_stage_records_are_user_locked_and_use_new_contract(self) -> None:
        records = list(seed_synthetic.stage_records())
        self.assertEqual({record["effective_stage"] for record in records}, {"LAUNCH", "SCALE", "HARVEST", "RECOVERY"})
        self.assertTrue(all(record["locked_by_user"] for record in records))
        self.assertTrue(all(record["confirmed_by_user_id"] for record in records))
        self.assertTrue(all("stage" not in record for record in records))
        self.assertTrue(all("assigned_by" not in record for record in records))


class MigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = migration_sql()

    def test_all_required_migrations_are_present(self) -> None:
        names = [path.name for path in sorted(MIGRATION_DIR.glob("*.sql"))]
        self.assertEqual(
            names,
            [
                "0001_foundation.sql",
                "0002_selection_procurement_finance.sql",
                "0003_ai_workflow_policy.sql",
                "0004_exact_selection_sourcing_logistics.sql",
                "0005_m1_jarvis_runtime.sql",
            ],
        )

    def test_sponsored_products_daily_table_is_tenant_isolated(self) -> None:
        self.assertIn("CREATE TABLE ads.fact_sp_advertising_daily", self.sql)
        self.assertIn("CREATE POLICY tenant_isolation ON ads.fact_sp_advertising_daily", self.sql)
        self.assertIn("attribution_window text NOT NULL CHECK (attribution_window = '14_DAY_CLICK')", self.sql)

    def test_synthetic_business_day_uses_la_boundaries(self) -> None:
        start, end = seed_synthetic.business_day_bounds(seed_synthetic.LOGICAL_TODAY)
        self.assertEqual(start.isoformat(), "2026-08-31T07:00:00+00:00")
        self.assertEqual(end.isoformat(), "2026-09-01T06:59:59.999999+00:00")

    def test_exact_36_selection_and_sourcing_physical_tables_exist(self) -> None:
        required = {
            "market.market_niches",
            "market.market_niche_snapshots",
            "market.product_opportunities",
            "market.opportunity_evidence",
            "market.public_market_observations",
            "market.creative_signals",
            "selection.candidate_products",
            "selection.candidate_product_snapshots",
            "selection.candidate_evaluations",
            "selection.candidate_score_versions",
            "selection.candidate_score_dimensions",
            "selection.candidate_risks",
            "selection.candidate_differentiation_ideas",
            "selection.candidate_research_tasks",
            "selection.candidate_project_stage_history",
            "selection.candidate_rejection_reasons",
            "sourcing.suppliers",
            "sourcing.supplier_contacts",
            "sourcing.supplier_products",
            "sourcing.supplier_quotes",
            "sourcing.contracts",
            "sourcing.purchase_orders",
            "sourcing.purchase_order_items",
            "sourcing.supplier_payments",
            "sourcing.payment_allocations",
            "logistics.logistics_shipments",
            "logistics.logistics_shipment_items",
            "logistics.inventory_batches",
            "logistics.landed_cost_allocations",
            "logistics.customs_costs",
            "logistics.freight_costs",
            "sourcing.packaging_costs",
            "procurement.document_entity_links",
            "sourcing.sample_orders",
            "sourcing.sample_evaluations",
            "finance.product_cost_scenarios",
        }
        self.assertEqual(len(required), 36)
        created = set(re.findall(r"CREATE TABLE\s+([a-z_]+\.[a-z_]+)\s*\(", self.sql, re.IGNORECASE))
        self.assertFalse(required.difference(created), required.difference(created))

    def test_user_required_ai_tables_exist(self) -> None:
        required = {
            "ai.ai_conversations",
            "ai.ai_messages",
            "ai.ai_runs",
            "ai.agent_runs",
            "ai.tool_calls",
            "ai.tool_outputs",
            "insights.ai_insights",
            "ai.homepage_compositions",
            "ai.homepage_blocks",
            "insights.recommendations",
            "insights.recommendation_evidence",
            "workflow.approvals",
            "workflow.action_executions",
            "workflow.action_rollbacks",
            "memory.business_memories",
            "policy_news.policy_items",
            "policy_news.policy_changes",
            "policy_news.policy_impacts",
            "policy_news.news_items",
            "insights.anomaly_events",
            "policy_news.notification_events",
            "ai.model_usage",
            "ai.prompt_versions",
            "policy_news.data_freshness",
        }
        created = set(re.findall(r"CREATE TABLE\s+([a-z_]+\.[a-z_]+)\s*\(", self.sql, re.IGNORECASE))
        self.assertFalse(required.difference(created), required.difference(created))

    def test_selection_procurement_and_cost_tables_exist(self) -> None:
        required = {
            "market.market_opportunities",
            "market.market_snapshots",
            "market.keyword_signals",
            "market.customer_pain_points",
            "market.creative_signals",
            "market.product_candidates",
            "market.candidate_stage_history",
            "market.candidate_evaluations",
            "market.candidate_evidence",
            "market.candidate_competitors",
            "procurement.suppliers",
            "procurement.supplier_products",
            "procurement.supplier_quotations",
            "procurement.quotation_lines",
            "procurement.purchase_orders",
            "procurement.purchase_order_lines",
            "procurement.payments",
            "procurement.payment_allocations",
            "procurement.logistics_shipments",
            "procurement.logistics_events",
            "procurement.logistics_costs",
            "finance.cost_scenarios",
            "finance.cost_scenario_components",
            "finance.product_cost_versions",
            "finance.cost_version_source_fields",
        }
        created = set(re.findall(r"CREATE TABLE\s+([a-z_]+\.[a-z_]+)\s*\(", self.sql, re.IGNORECASE))
        self.assertFalse(required.difference(created), required.difference(created))

    def test_provenance_separates_transport_from_semantics(self) -> None:
        provenance_section = self.sql.split("CREATE TABLE connectors.data_provenance", 1)[1].split("CREATE TABLE", 1)[0]
        self.assertIn("'SYNTHETIC', 'LIVE_API', 'USER_UPLOAD', 'PUBLIC_WEB'", provenance_section)
        self.assertIn("'FIRST_PARTY', 'THIRD_PARTY_ESTIMATE', 'PUBLIC_OBSERVATION', 'USER_PROVIDED', 'AI_INFERENCE'", provenance_section)
        self.assertNotIn("CHECK (source_kind IN ('FIRST_PARTY'", provenance_section)

    def test_product_stage_contract_is_user_controlled(self) -> None:
        section = self.sql.split("CREATE TABLE catalog.product_stage_history", 1)[1].split("CREATE TABLE", 1)[0]
        for column in (
            "recommended_stage",
            "effective_stage",
            "stage_confidence",
            "stage_reasons",
            "manual_override",
            "override_reason",
            "locked_by_user",
            "effective_from",
            "effective_to",
            "confirmed_by_user_id",
        ):
            self.assertRegex(section, rf"\b{column}\b")
        self.assertIn("CHECK (locked_by_user)", section)
        self.assertIn("product_stage_effective_immutable", self.sql)
        self.assertIn("effective stage is immutable", self.sql)

    def test_ocr_fields_must_be_confirmed_before_complete_cost(self) -> None:
        self.assertIn("confirmation_status text NOT NULL DEFAULT 'CONFIRMED' CHECK (confirmation_status = 'CONFIRMED')", self.sql)
        self.assertIn("REFERENCES procurement.document_extracted_fields(tenant_id, field_id, confirmation_status)", self.sql)
        self.assertIn("OCR-confirmed cost version", self.sql)
        self.assertIn("DEFERRABLE INITIALLY DEFERRED", self.sql)

    def test_raw_provenance_and_audit_are_append_only(self) -> None:
        for trigger in (
            "raw_objects_append_only",
            "data_provenance_append_only",
            "audit_events_append_only",
            "approval_events_append_only",
            "homepage_compositions_append_only",
            "cost_version_source_fields_append_only",
        ):
            self.assertIn(trigger, self.sql)
        self.assertIn("BEFORE UPDATE OR DELETE", self.sql)

    def test_every_tenant_table_has_an_rls_target(self) -> None:
        table_blocks = re.findall(
            r"CREATE TABLE\s+([a-z_]+\.[a-z_]+)\s*\((.*?)(?=\n\);)",
            self.sql,
            re.IGNORECASE | re.DOTALL,
        )
        tenant_tables = {name for name, body in table_blocks if re.search(r"\btenant_id\s+uuid\b", body)}
        policy_targets = set(re.findall(r"'([a-z_]+\.[a-z_]+)'::regclass", self.sql))
        policy_targets.update(
            re.findall(r"CREATE POLICY\s+\w+\s+ON\s+([a-z_]+\.[a-z_]+)", self.sql, re.IGNORECASE)
        )
        policy_targets.add("iam.tenants")
        self.assertFalse(tenant_tables.difference(policy_targets), tenant_tables.difference(policy_targets))
        self.assertIn("NOBYPASSRLS", self.sql)
        self.assertIn("FORCE ROW LEVEL SECURITY", self.sql)

    def test_mvp_execution_contract_is_manual_only(self) -> None:
        action_section = self.sql.split("CREATE TABLE workflow.action_executions", 1)[1].split("CREATE TABLE", 1)[0]
        tool_section = self.sql.split("CREATE TABLE ai.tool_calls", 1)[1].split("CREATE TABLE", 1)[0]
        self.assertIn("execution_mode = 'MANUAL_RECORDED'", action_section)
        self.assertNotIn("LIVE_API", action_section)
        self.assertIn("'READ_ONLY', 'LOCAL_COMPUTE', 'CREATE_DRAFT'", tool_section)
        self.assertNotIn("EXECUTE_EXTERNAL", tool_section)


class ComposeContractTests(unittest.TestCase):
    def test_compose_uses_postgres_and_s3_compatible_storage(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("postgres:16-alpine", compose)
        self.assertIn("minio/minio:", compose)
        self.assertIn("./infra/postgres/migrations:/docker-entrypoint-initdb.d:ro", compose)
        self.assertNotRegex(compose, r"(?i)(sk-[a-z0-9]|refresh_token\s*:)")

    def test_compose_builds_web_and_api_with_healthchecks(self) -> None:
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertRegex(compose, r"(?m)^  web:\s*$")
        self.assertRegex(compose, r"(?m)^  api:\s*$")
        self.assertIn("context: ./apps/web", compose)
        self.assertIn("dockerfile: apps/api/Dockerfile", compose)
        self.assertGreaterEqual(compose.count("healthcheck:"), 4)
        self.assertTrue((ROOT / "apps" / "web" / "Dockerfile").is_file())
        self.assertTrue((ROOT / "apps" / "api" / "Dockerfile").is_file())


if __name__ == "__main__":
    unittest.main()
