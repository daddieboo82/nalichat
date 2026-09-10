// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PricingPlans from "@/components/pricing/PricingPlans";

const mockSubscription = vi.hoisted(() => ({
  current: {
    subscription: {
      plan: "free",
      status: "active",
      hasPaidAccess: false,
      trialEligible: true,
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  },
}));
const mockAuth = vi.hoisted(() => ({
  current: { isAuthenticated: true, user: { id: "user-1" } },
}));
const mockStartCheckout = vi.hoisted(() => vi.fn());
const mockTrack = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockSubscription.current,
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => mockAuth.current,
}));
vi.mock("@/lib/subscriptionBilling", () => ({
  CHECKOUT_RETURN_KEY: "nalichat_subscription_checkout_started",
  createCheckoutRequestKey: () => "checkout_request_1234",
  startSubscriptionCheckout: mockStartCheckout,
}));
vi.mock("@/lib/paywallAnalytics", () => ({
  trackPaywallEvent: mockTrack,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function renderPricing(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/pricing"]}>
      <Routes>
        <Route path="/pricing" element={<PricingPlans {...props} />} />
        <Route path="/messages" element={<div>Free chat</div>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("pricing plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockStartCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.example" });
    mockSubscription.current = {
      subscription: {
        plan: "free",
        status: "active",
        hasPaidAccess: false,
        trialEligible: true,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    mockAuth.current = { isAuthenticated: true, user: { id: "user-1" } };
  });

  afterEach(cleanup);

  it("renders variant A, defaults yearly, and toggles to monthly prices", () => {
    renderPricing({ variantOverride: "A" });

    expect(screen.getByRole("heading", { name: "Upgrade your chat, not your budget." })).toBeTruthy();
    expect(screen.getByText("Most popular")).toBeTruthy();
    expect(screen.getByText("$59.99")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText("$7.99")).toBeTruthy();
  });

  it("renders variant B copy and server-eligibility-aware purchase language", () => {
    mockSubscription.current.subscription.trialEligible = false;
    renderPricing({ variantOverride: "B" });

    expect(screen.getByRole("heading", { name: "Go further with AI-powered messaging." })).toBeTruthy();
    expect(screen.getByText("Best for everyday")).toBeTruthy();
    expect(screen.queryByText("Try Premium free")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Choose plan" })).toHaveLength(2);
  });

  it("sends the approved plan and period SKU to checkout once", async () => {
    renderPricing({ variantOverride: "A" });

    fireEvent.click(screen.getAllByRole("button", { name: "Start 7-day free trial" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Start 7-day free trial" })[0]);

    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledTimes(1));
    expect(mockStartCheckout).toHaveBeenCalledWith({
      sku: "premium_yearly",
      idempotencyKey: "checkout_request_1234",
    });
  });

  it("keeps Continue with Free visible and returns directly to chat", async () => {
    renderPricing({ variantOverride: "A" });
    const continueButtons = screen.getAllByRole("button", { name: "Continue with Free" });
    expect(continueButtons.length).toBeGreaterThan(0);

    fireEvent.click(continueButtons[0]);
    expect(await screen.findByText("Free chat")).toBeTruthy();
  });

  it("honors the paywall kill switch", () => {
    renderPricing({ enabled: false, variantOverride: "A" });
    expect(screen.getByText("Plans are temporarily unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Free" })).toBeTruthy();
    expect(screen.queryByText("$59.99")).toBeNull();
  });
});
