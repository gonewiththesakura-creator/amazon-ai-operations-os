import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentRegistry } from "../components/ComponentRegistry";
import type { ComponentType } from "../types/home";
import { homeBlock } from "./fixtures/home";

describe("ComponentRegistry", () => {
  it("renders a registered dynamic block and synthetic badge", () => {
    render(<ComponentRegistry block={homeBlock()} onAction={vi.fn()} />);

    expect(screen.getByText("今日订单显著低于合格基线")).toBeInTheDocument();
    expect(screen.getByText("SYNTHETIC")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("fails safely and visibly for an unknown component", () => {
    const unknown = homeBlock({
      block_id: "10000000-0000-4000-8000-000000000099",
      component_type: "future_component" as ComponentType,
      component_version: "9.9",
    });

    render(<ComponentRegistry block={unknown} onAction={vi.fn()} />);

    expect(screen.getByText("Unsupported component")).toBeInTheDocument();
    expect(screen.getByText(/future_component@9.9/)).toBeInTheDocument();
  });
});
