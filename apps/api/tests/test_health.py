def test_health_is_public_and_reports_synthetic_mode(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "amazon-ai-api",
        "version": "0.1.0",
        "mode": "synthetic",
    }


def test_readiness_validates_safe_registries(client) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["components"] == 20
    assert body["agents"] == 12
    assert body["tools"] == 22
    assert body["external_writes_enabled"] is False

