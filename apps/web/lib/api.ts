import type { ChatRequest, ChatResponse } from "../types/chat";
import type { HomeComposition } from "../types/home";
import type { HomeVisualizationsResponse } from "../types/visualization";

export const DEMO_TENANT_ID =
  process.env.NEXT_PUBLIC_DEMO_TENANT_ID ?? "00000000-0000-0000-0000-000000000001";

const DEMO_BUSINESS_DATE = process.env.NEXT_PUBLIC_DEMO_BUSINESS_DATE ?? "2026-08-31";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": DEMO_TENANT_ID,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || `Request failed with ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export function getHomeComposition(signal?: AbortSignal): Promise<HomeComposition> {
  const query = DEMO_BUSINESS_DATE ? `?business_date=${encodeURIComponent(DEMO_BUSINESS_DATE)}` : "";
  return requestJson<HomeComposition>(`/v1/home/composition${query}`, { signal });
}

export function getHomeVisualizations(signal?: AbortSignal): Promise<HomeVisualizationsResponse> {
  const query = new URLSearchParams({ lookback_days: "30" });
  if (DEMO_BUSINESS_DATE) query.set("business_date", DEMO_BUSINESS_DATE);
  return requestJson<HomeVisualizationsResponse>(`/v1/visualizations/home?${query.toString()}`, { signal });
}

export function sendChatMessage(payload: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  return requestJson<ChatResponse>("/v1/chat", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}
