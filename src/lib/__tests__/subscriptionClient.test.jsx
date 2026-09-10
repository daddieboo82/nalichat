// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  checkSubscriptionStatus,
  normalizeSubscription,
} from "@/lib/subscriptionClient";
import { useSubscription } from "@/hooks/useSubscription";

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@/api/base44Client", () => ({
  base44: { functions: { invoke: mockInvoke } },
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "user-1" },
  }),
}));

function wrapper({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("subscription client normalization", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("normalizes canonical plan, billing, trial, grandfathering, and entitlements", () => {
    const subscription = normalizeSubscription({
      plan: "premium_plus",
      status: "trialing",
      billingPeriod: "annual",
      provider: "stripe",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      trialEndDate: "2026-09-17T00:00:00.000Z",
      trialEligible: false,
      grandfathered: true,
      grandfatheredFromPlan: "pro",
      hasPaidAccess: true,
      limits: {
        ai: { requestsPerUtcDay: 1_000 },
        upload: { maxBytes: 20 * 1024 * 1024 * 1024 },
      },
      entitlements: {
        "chat.core": true,
        "files.large_upload": true,
      },
    });

    expect(subscription).toMatchObject({
      plan: "premium_plus",
      status: "trialing",
      billingPeriod: "annual",
      isTrialing: true,
      grandfathered: true,
      grandfatheredFromPlan: "pro",
      hasPaidAccess: true,
    });
    expect(subscription.entitlements["files.large_upload"]).toBe(true);
    expect(subscription.entitlements["privacy.locked_chats"]).toBe(false);
    expect(subscription.limits.ai.requestsPerUtcDay).toBe(1_000);
    expect(subscription.limits.upload.maxBytes).toBe(20 * 1024 * 1024 * 1024);
  });

  it("does not derive limits from an unrecognized client plan", () => {
    const subscription = normalizeSubscription({
      plan: "premium_plus",
      claimedPlan: "unlimited",
      claimedAiLimit: Number.MAX_SAFE_INTEGER,
      limits: {
        ai: { requestsPerUtcDay: 1_000 },
        upload: { maxBytes: 20 * 1024 * 1024 * 1024 },
      },
    });

    expect(subscription.plan).toBe("premium_plus");
    expect(subscription.limits.ai.requestsPerUtcDay).toBe(1_000);
  });

  it("treats an error-shaped API response as a failure", async () => {
    mockInvoke.mockResolvedValue({ data: { error: "status unavailable" } });
    await expect(checkSubscriptionStatus()).rejects.toThrow("status unavailable");
  });

  it("does not grant paid access when the hook query fails", async () => {
    mockInvoke.mockRejectedValue(new Error("network unavailable"));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.hasPaidAccess).toBe(false);
    expect(result.current.hasEntitlement("files.large_upload")).toBe(false);
    expect(result.current.hasEntitlement("chat.core")).toBe(true);
    expect(result.current.error.message).toBe("network unavailable");
  });

  it("fails closed when a paid result is followed by a refetch error", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          plan: "premium",
          status: "active",
          hasPaidAccess: true,
          entitlements: {
            "chat.core": true,
            "files.large_upload": true,
          },
        },
      })
      .mockRejectedValueOnce(new Error("verification unavailable"));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.hasPaidAccess).toBe(true));
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.hasPaidAccess).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.hasEntitlement("files.large_upload")).toBe(false);
  });
});
