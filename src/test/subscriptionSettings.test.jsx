// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubscriptionSettings from "@/components/settings/SubscriptionSettings";

const mockSubscription = vi.hoisted(() => ({
  current: {
    subscription: {
      plan: "premium_plus",
      status: "active",
      billingPeriod: "annual",
      provider: "stripe",
      currentPeriodEnd: "2026-12-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      trialEndDate: null,
      grandfathered: true,
      grandfatheredFromPlan: "pro_filesharing",
      hasPaidAccess: true,
      isTrialing: false,
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  },
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockSubscription.current,
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
vi.mock("@/lib/subscriptionBilling", () => ({ openBillingPortal: vi.fn() }));
vi.mock("@/lib/paywallAnalytics", () => ({ trackPaywallEvent: vi.fn() }));

describe("subscription settings", () => {
  beforeEach(() => {
    mockSubscription.current = {
      subscription: {
        plan: "premium_plus",
        status: "active",
        billingPeriod: "annual",
        provider: "stripe",
        currentPeriodEnd: "2026-12-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        trialEndDate: null,
        grandfathered: true,
        grandfatheredFromPlan: "pro_filesharing",
        hasPaidAccess: true,
        isTrialing: false,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  afterEach(cleanup);

  it("shows a grandfathered Premium Plus subscription and billing controls", () => {
    render(
      <MemoryRouter>
        <SubscriptionSettings />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Premium Plus" })).toBeTruthy();
    expect(screen.getByText("Grandfathered")).toBeTruthy();
    expect(screen.getByText(/current external price/)).toBeTruthy();
    expect(screen.getByText("Yearly")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Billing" })).toBeTruthy();
  });

  it("keeps billing recovery available when a Stripe subscription is unpaid", () => {
    mockSubscription.current = {
      ...mockSubscription.current,
      subscription: {
        ...mockSubscription.current.subscription,
        status: "unpaid",
        hasPaidAccess: false,
        grandfathered: false,
      },
    };

    render(
      <MemoryRouter>
        <SubscriptionSettings />
      </MemoryRouter>,
    );

    expect(screen.getByText("unpaid")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Billing" })).toBeTruthy();
  });
});
