from conftest import TENANT_A


def request_payload(message: str = "为什么今天订单下降？") -> dict[str, object]:
    return {
        "message": message,
        "marketplace": "ATVPDKIKX0DER",
        "business_date": "2026-08-31",
        "context": {
            "business_date": "2026-08-31",
            "marketplace": "ATVPDKIKX0DER",
            "selected_asin": None,
            "selected_campaign": None,
            "home_composition_id": "c09f0dc6-7ff7-5690-b8ca-33ab9c3a6618",
        },
    }


def test_chat_runs_store_agent_and_returns_evidence(client, tenant_headers) -> None:
    response = client.post("/v1/chat", headers=tenant_headers, json=request_payload())

    assert response.status_code == 200
    body = response.json()
    assert "-55.00%" in body["answer"]
    assert "-24.00%" in body["answer"]
    assert len(body["findings"]) == 3
    assert body["evidence_refs"]
    assert all(item["evidence_refs"] for item in body["findings"])
    assert all(item["source"] for item in body["findings"])
    assert all(item["updated_at"] for item in body["findings"])
    assert body["synthetic"] is True
    assert body["context_snapshot"]["business_date"] == "2026-08-31"
    assert body["context_snapshot"]["marketplace"] == "ATVPDKIKX0DER"


def test_followup_carries_previous_run_and_warns_provisional_ads(
    client, tenant_headers
) -> None:
    first = client.post("/v1/chat", headers=tenant_headers, json=request_payload()).json()
    payload = request_payload("我现在应该先改广告吗？")
    payload["context"]["previous_ai_run_id"] = first["ai_run_id"]

    response = client.post("/v1/chat", headers=tenant_headers, json=payload)

    assert response.status_code == 200
    body = response.json()
    assert "不建议直接修改广告" in body["answer"]
    assert "PROVISIONAL" in body["answer"]
    assert "不会执行任何修改" in body["answer"]
    assert body["ai_run_id"] != first["ai_run_id"]
    assert body["context_snapshot"]["previous_ai_run_id"] == body["ai_run_id"]


def test_chat_rejects_context_scope_mismatch(client, tenant_headers) -> None:
    payload = request_payload()
    payload["context"]["marketplace"] = "OTHER"

    response = client.post("/v1/chat", headers=tenant_headers, json=payload)

    assert response.status_code == 422


def test_chat_requires_tenant_header(client) -> None:
    response = client.post("/v1/chat", json=request_payload())

    assert response.status_code == 422


def test_chat_tenant_is_taken_only_from_authenticated_header(client) -> None:
    response = client.post(
        "/v1/chat?tenant_id=22222222-2222-4222-8222-222222222222",
        headers={"X-Tenant-Id": str(TENANT_A)},
        json=request_payload(),
    )

    assert response.status_code == 200
