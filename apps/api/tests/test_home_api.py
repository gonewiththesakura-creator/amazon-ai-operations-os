from conftest import TENANT_A, TENANT_B


def test_normal_home_composition_is_dynamic_typed_and_synthetic(
    client, tenant_headers
) -> None:
    response = client.get(
        "/v1/home/composition",
        params={"state": "NORMAL", "business_date": "2026-08-30"},
        headers=tenant_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tenant_id"] == str(TENANT_A)
    assert body["home_state"] == "NORMAL"
    assert body["objective_profile"] == "SCALE_GROWTH"
    assert body["synthetic"] is True
    assert body["data_status"]["status"] == "SYNTHETIC"
    assert [block["component_type"] for block in body["blocks"]] == [
        "executive_summary",
        "positive_signal",
        "competitor_change",
        "product_opportunity",
        "experiment_result",
    ]
    assert [block["priority"] for block in body["blocks"]] == [1, 2, 3, 4, 5]
    assert len(body["top_actions"]) == 3
    assert all(action["requires_approval"] for action in body["top_actions"])
    for block in body["blocks"]:
        assert block["synthetic"] is True
        assert block["display_reason"]
        assert block["evidence_refs"]
        assert block["provenance"]
        assert all(item["synthetic"] is True for item in block["provenance"])


def test_order_ad_anomaly_changes_priority_and_objective(client, tenant_headers) -> None:
    response = client.get(
        "/v1/home/composition",
        params={"state": "ORDER_AD_ANOMALY", "business_date": "2026-08-30"},
        headers=tenant_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["home_state"] == "ORDER_AD_ANOMALY"
    assert body["objective_profile"] == "RECOVERY_RANK"
    assert body["blocks"][0]["component_type"] == "critical_alert"
    assert body["blocks"][1]["component_type"] == "order_funnel"
    assert body["blocks"][2]["component_type"] == "ad_diagnosis"
    assert body["blocks"][2]["payload"]["acos"] == 90.02
    assert body["top_issue"]["severity"] == "CRITICAL"
    assert body["overall_confidence"] >= 0.9


def test_unsupported_m0_state_is_explicit(client, tenant_headers) -> None:
    response = client.get(
        "/v1/home/composition",
        params={"state": "INVENTORY_PROFIT_RISK"},
        headers=tenant_headers,
    )

    assert response.status_code == 422
    assert "does not implement state" in response.json()["detail"]


def test_tenant_header_is_required_and_invalid_tenant_is_rejected(client) -> None:
    missing = client.get("/v1/home/composition")
    invalid = client.get(
        "/v1/home/composition", headers={"X-Tenant-Id": "not-a-uuid"}
    )

    assert missing.status_code == 422
    assert invalid.status_code == 422


def test_composition_ids_and_raw_references_are_tenant_scoped(client) -> None:
    response_a = client.get(
        "/v1/home/composition", headers={"X-Tenant-Id": str(TENANT_A)}
    )
    response_b = client.get(
        "/v1/home/composition", headers={"X-Tenant-Id": str(TENANT_B)}
    )

    body_a = response_a.json()
    body_b = response_b.json()
    assert body_a["tenant_id"] == str(TENANT_A)
    assert body_b["tenant_id"] == str(TENANT_B)
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
