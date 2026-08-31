from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Settings:
    app_data_mode: str = "SYNTHETIC"
    database_url: str = "postgresql://amazon_ai_admin:change-me-local-only@127.0.0.1:5432/amazon_ai_ops"
    business_timezone: str = "America/Los_Angeles"
    openai_enabled: bool = False
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.2"
    web_origins: tuple[str, ...] = ("http://127.0.0.1:3000", "http://localhost:3000")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_data_mode=os.getenv("APP_DATA_MODE", "SYNTHETIC").upper(),
            database_url=os.getenv(
                "DATABASE_URL",
                "postgresql://amazon_ai_admin:change-me-local-only@127.0.0.1:5432/amazon_ai_ops",
            ),
            business_timezone=os.getenv("BUSINESS_TIMEZONE", "America/Los_Angeles"),
            openai_enabled=os.getenv("OPENAI_ENABLED", "false").lower() == "true",
            openai_api_key=os.getenv("OPENAI_API_KEY") or None,
            openai_model=os.getenv("OPENAI_MODEL", "gpt-5.2"),
            web_origins=tuple(
                item.strip()
                for item in os.getenv(
                    "WEB_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000"
                ).split(",")
                if item.strip()
            ),
        )

    @property
    def ai_mode(self) -> str:
        return "ENABLED" if self.openai_enabled and self.openai_api_key else "DETERMINISTIC_FALLBACK"

