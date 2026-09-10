import { describe, expect, it, vi } from "vitest";
import { pollForSubscriptionConfirmation } from "@/lib/subscriptionConfirmation";

describe("subscription confirmation polling", () => {
  it("stops when authoritative paid access is observed", async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce({ hasPaidAccess: false })
      .mockResolvedValueOnce({ hasPaidAccess: true, plan: "premium" });
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await pollForSubscriptionConfirmation({
      fetchStatus,
      delays: [0, 10, 20],
      wait,
    });

    expect(result.outcome).toBe("confirmed");
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded timeout when status checks succeed without paid access", async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ hasPaidAccess: false });

    const result = await pollForSubscriptionConfirmation({
      fetchStatus,
      delays: [0, 1, 2],
      wait: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.outcome).toBe("timeout");
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it("returns failure when every status check errors", async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await pollForSubscriptionConfirmation({
      fetchStatus,
      delays: [0, 1],
      wait: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.outcome).toBe("failed");
    expect(result.error.message).toBe("offline");
  });
});

