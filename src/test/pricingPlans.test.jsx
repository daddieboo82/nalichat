// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PricingPlans from "@/components/pricing/PricingPlans";
import BounceDialog from "@/components/studio/BounceDialog";

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
  useSubscription: () => ({ hasEntitlement: () => false, ...mockSubscription.current }),
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => mockAuth.current,
}));
vi.mock("@/lib/subscriptionBilling", () => ({
  CHECKOUT_ATTRIBUTION_KEY: "checkout-attribution",
  CHECKOUT_RETURN_KEY: "nalichat_subscription_checkout_started",
  createCheckoutRequestKey: () => "checkout_request_1234",
  startSubscriptionCheckout: mockStartCheckout,
}));
vi.mock("@/lib/paywallAnalytics", () => ({
  trackPaywallEvent: mockTrack,
}));
vi.mock("@/hooks/useAppleIAP", () => ({
  useAppleIAP: () => ({
    available: false,
    purchasingProductId: null,
    restoring: false,
    purchase: vi.fn(),
    restore: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

function renderPricing(props = {}, entry = "/pricing") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/pricing" element={<PricingPlans {...props} />} />
        <Route path="/messages" element={<div>Free chat</div>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("pricing plans", () => {
  it("clearly explains the free starting point and paid-plan cancellation path", () => {
    renderPricing({ variantOverride: "A" });
    expect(screen.getByText(/Make music\. Find collaborators\. Finish songs\. Release more\./i)).toBeTruthy();
    expect(screen.getByText(/Premium starts at \$7\.99\/month/i)).toBeTruthy();
    expect(screen.getByText(/Paid subscriptions can be canceled in Settings/i)).toBeTruthy();
  });

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

  it("opens Studio mastering pricing separately without dismissing the bounce dialog", () => {
    render(
      <MemoryRouter>
        <BounceDialog open onOpenChange={vi.fn()} projectTitle="Test mix" tracks={[]} />
      </MemoryRouter>,
    );

    const offer = screen.getByRole("link", { name: /Premium \$7.99\/month/ });
    expect(offer.getAttribute("target")).toBe("_blank");
    expect(offer.getAttribute("href")).toBe("/pricing?source=studio_bounce&feature=studio.ai_mastering");
    offer.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(offer);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByPlaceholderText("Song name").value).toBe("Test mix");
    expect(mockTrack).toHaveBeenCalledWith("upgrade_click", {
      source: "studio_bounce",
      upgrade_feature: "studio.ai_mastering",
    });
  });

  it("records an explicit PayPal cancel return with the original Studio source", () => {
    sessionStorage.setItem("nalichat_subscription_checkout_started", "1");
    sessionStorage.setItem("checkout-attribution", JSON.stringify({
      source: "studio_bounce",
      feature: "studio.ai_mastering",
      sku: "premium_monthly",
    }));

    renderPricing({}, "/pricing?checkout=paypal_canceled");

    expect(screen.getByText(/returned from PayPal without completing/i)).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith("checkout_canceled", {
      source: "studio_bounce",
      upgrade_feature: "studio.ai_mastering",
      checkout_sku: "premium_monthly",
    });
    expect(sessionStorage.getItem("nalichat_subscription_checkout_started")).toBeNull();
  });

  it("keeps Studio mastering attribution through checkout", async () => {
    renderPricing({ variantOverride: "A" }, "/pricing?source=studio_bounce&feature=studio.ai_mastering");

    expect(screen.getByText(/AI Auto-Mastering applies EQ, compression, and limiting/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Premium" }));

    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledWith(expect.objectContaining({
      sku: "premium_monthly",
    })));
    for (const event of ["paywall_view", "paywall_tier_select", "checkout_started"]) {
      expect(mockTrack).toHaveBeenCalledWith(event, expect.objectContaining({
        source: "studio_bounce",
        upgrade_feature: "studio.ai_mastering",
      }));
    }
  });

  it("renders variant A, defaults monthly, and toggles to yearly prices", () => {
    renderPricing({ variantOverride: "A" });

    expect(screen.getByRole("heading", { name: "Finish more music with everything in one place." })).toBeTruthy();
    expect(screen.getByText("Best value to get started")).toBeTruthy();
    expect(screen.getByText("$7.99")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(screen.getByText("$59.99")).toBeTruthy();
  });

  it("renders variant B copy and server-eligibility-aware purchase language", () => {
    mockSubscription.current.subscription.trialEligible = false;
    renderPricing({ variantOverride: "B" });

    expect(screen.getByRole("heading", { name: "Turn ideas into finished releases faster." })).toBeTruthy();
    expect(screen.getByText("Best value to get started")).toBeTruthy();
    expect(screen.queryByText("Try Premium free")).toBeNull();
    expect(screen.getByRole("button", { name: "Upgrade to Premium" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go Premium Plus" })).toBeTruthy();
  });

  it("sends the approved plan and period SKU to checkout once", async () => {
    renderPricing({ variantOverride: "A" });

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Premium" }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Premium" }));

    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledTimes(1));
    expect(mockStartCheckout).toHaveBeenCalledWith({
      sku: "premium_monthly",
      idempotencyKey: "checkout_request_1234",
      expectedUserId: "user-1",
    });
  });

  it("keeps the current-plan escape visible and returns directly to chat", async () => {
    renderPricing({ variantOverride: "A" });
    const continueButtons = screen.getAllByRole("button", { name: "Keep current plan" });
    expect(continueButtons.length).toBeGreaterThan(0);

    fireEvent.click(continueButtons[0]);
    expect(await screen.findByText("Free chat")).toBeTruthy();
  });

  it("honors the paywall kill switch", () => {
    renderPricing({ enabled: false, variantOverride: "A" });
    expect(screen.getByText("Plans are temporarily unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Return to NaliBase" })).toBeTruthy();
    expect(screen.queryByText("$59.99")).toBeNull();
  });
});