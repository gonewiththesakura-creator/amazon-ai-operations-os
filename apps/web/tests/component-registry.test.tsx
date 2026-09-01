import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentRegistry } from "../components/ComponentRegistry";
import type { ComponentType } from "../types/home";
import { homeBlock } from "./fixtures/home";

describe("ComponentRegistry", () => {
  afterEach(() => cleanup());

  it("renders a registered dynamic block while keeping provenance in Inspector", () => {
    renderRegistry(homeBlock());

    expect(screen.getByText("今日订单显著低于合格基线")).toBeInTheDocument();
    expect(screen.queryByText(/基于 Amazon SP 模拟数据/)).not.toBeInTheDocument();
    expect(screen.queryByText("展开来源与口径")).not.toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看依据：今日订单显著低于合格基线" })).toBeEnabled();
  });

  it("fails safely and visibly for an unknown component", () => {
    const unknown = homeBlock({
      block_id: "10000000-0000-4000-8000-000000000099",
      component_type: "future_component" as ComponentType,
      component_version: "9.9",
    });

    renderRegistry(unknown);

    const fallback = screen.getByRole("status");
    expect(fallback).toHaveTextContent("这部分内容暂时无法展示");
    expect(fallback).toHaveTextContent("原始引用仍然保留，可在依据面板中检查");
  });
});

function renderRegistry(block: ReturnType<typeof homeBlock>) {
  return render(
    <ComponentRegistry
      block={block}
      reducedMotion
      onOpenAction={vi.fn()}
      onOpenEvidence={vi.fn()}
      onSubmitFollowUp={vi.fn()}
    />,
  );
}
