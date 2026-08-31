from conftest import TENANT_A, TENANT_B


def test_home_is_automatic_database_backed_and_synthetic(client, tenant_headers) -> None:
    response = client.get("/v1/home/composition", headers=tenant_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["tenant_id"] == str(TENANT_A)
    assert body["business_date"] == "2026-08-31"
    assert body["home_state"] == "ORDER_AD_ANOMALY"
    assert body["data_status"]["status"] == "PROVISIONAL"
    assert body["data_status"]["ai_mode"] == "DETERMINISTIC_FALLBACK"
    assert body["synthetic"] is True
    assert [block["component_type"] for block in body["blocks"]] == [
        "critical_alert",
        "order_funnel",
        "ad_diagnosis",
        "priority_action",
        "data_table",
        "follow_up_question",
    ]
    assert body["blocks"][0]["payload"]["observed_value"] == 45
    assert body["blocks"][0]["payload"]["baseline_value"] == 100
    assert body["blocks"][0]["payload"]["delta_pct"] == -55
    assert all(block["synthetic"] for block in body["blocks"])
    assert all(block["evidence_refs"] for block in body["blocks"])
    assert all(block["provenance"] for block in body["blocks"])


def test_state_query_cannot_override_deterministic_home_state(client, tenant_headers) -> None:
    response = client.get(
        "/v1/home/composition", params={"state": "NORMAL"}, headers=tenant_headers
    )

    assert response.status_code == 200
    assert response.json()["home_state"] == "ORDER_AD_ANOMALY"


def test_tenant_header_is_required_and_invalid_tenant_is_rejected(client) -> None:
    missing = client.get("/v1/home/composition")
    invalid = client.get(
        "/v1/home/composition", headers={"X-Tenant-Id": "not-a-uuid"}
    )

    assert missing.status_code == 422
    assert invalid.status_code == 422


def test_composition_ids_and_database_references_are_tenant_scoped(client) -> None:
    response_a = client.get(
        "/v1/home/composition", headers={"X-Tenant-Id": str(TENANT_A)}
    )
    response_b = client.get(
        "/v1/home/composition", headers={"X-Tenant-Id": str(TENANT_B)}
    )

    body_a = response_a.json()
    body_b = response_b.json()
    assert body_a["composition_id"] != body_b["composition_id"]
    raw_a = body_a["blocks"][0]["provenance"][0]["raw_record_reference"]
    raw_b = body_b["blocks"][0]["provenance"][0]["raw_record_reference"]
    assert raw_a != raw_b


def test_query_string_cannot_override_authenticated_tenant(client) -> None:
    response = client.get(
        "/v1/home/composition",
        params={"tenant_id": str(TENANT_B)},
        headers={"X-Tenant-Id": str(TENANT_A)},
    )
    assert response.status_code == 200
    assert response.json()["tenant_id"] == str(TENANT_A)

