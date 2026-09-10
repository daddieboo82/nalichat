const DEFAULT_DELAYS_MS = Object.freeze([0, 750, 1500, 2500, 4000, 6000]);

const delay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

export async function pollForSubscriptionConfirmation({
  fetchStatus,
  delays = DEFAULT_DELAYS_MS,
  wait = delay,
}) {
  let successfulChecks = 0;
  let lastError = null;

  for (const waitTime of delays) {
    if (waitTime > 0) {
      await wait(waitTime);
    }

    try {
      const subscription = await fetchStatus();
      successfulChecks += 1;
      if (subscription?.hasPaidAccess === true) {
        return { outcome: "confirmed", subscription };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (successfulChecks === 0) {
    return { outcome: "failed", error: lastError || new Error("Subscription verification failed") };
  }
  return { outcome: "timeout" };
}

