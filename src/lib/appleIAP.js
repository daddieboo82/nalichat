import { Capacitor } from "@capacitor/core";

/**
 * Apple In-App Purchase service for NaliBase.
 *
 * Uses capacitor-plugin-cdv-purchase (StoreKit 2 on iOS) to handle
 * auto-renewable subscription purchases. On web, all methods are no-ops
 * so the existing PayPal/Stripe checkout flow remains untouched.
 */

// Apple product IDs must match the Auto-Renewable Subscriptions created
// in App Store Connect. We reuse the existing catalog SKUs.
export const APPLE_PRODUCT_IDS = Object.freeze([
  "premium_monthly",
  "premium_yearly",
  "premium_plus_monthly",
  "premium_plus_yearly",
]);

// Map Apple product IDs to NaliBase plan + billing period.
const PRODUCT_TO_PLAN = Object.freeze({
  premium_monthly: { plan: "premium", billingPeriod: "monthly" },
  premium_yearly: { plan: "premium", billingPeriod: "annual" },
  premium_plus_monthly: { plan: "premium_plus", billingPeriod: "monthly" },
  premium_plus_yearly: { plan: "premium_plus", billingPeriod: "annual" },
});

export function applePlanFromProductId(productId) {
  return PRODUCT_TO_PLAN[productId] || null;
}

export function isAppleIAPAvailable() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios"
  );
}

let storeModule = null;
let initialized = false;
let initPromise = null;
let verifiedCallback = null;

async function loadStoreModule() {
  if (!storeModule) {
    const mod = await import("capacitor-plugin-cdv-purchase");
    storeModule = mod;
  }
  return storeModule;
}

/**
 * Initialize the StoreKit store and register product listeners.
 * Call this once on app mount when running on iOS native.
 *
 * @param {function} onVerified - Called with normalized transaction data
 *   after a purchase or restore is verified by StoreKit.
 * @returns {Promise<void>}
 */
export async function initializeAppleIAP(onVerified) {
  if (!isAppleIAPAvailable()) return;
  if (initialized) return;
  if (initPromise) return initPromise;

  verifiedCallback = onVerified;

  initPromise = (async () => {
    try {
      const { store, ProductType, Platform, LogLevel, Logger } =
        await loadStoreModule();

      // Silence verbose logging in production.
      if (Logger) Logger.setLogLevel(LogLevel.ERROR);

      // Register all subscription products with the Apple App Store.
      store.register(
        APPLE_PRODUCT_IDS.map((id) => ({
          id,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        })),
      );

      // When a transaction is approved by the store, verify it.
      store.when().approved(async (transaction) => {
        try {
          await transaction.verify();
        } catch (error) {
          console.error("Apple IAP: transaction verify failed", error);
        }
      });

      // When a receipt is verified, send it to the backend and finish.
      store.when().verified(async (receipt) => {
        try {
          const transaction = receipt.lastTransaction();
          if (transaction && verifiedCallback) {
            const data = normalizeTransaction(transaction);
            if (data) await verifiedCallback(data);
          }
          await receipt.finish();
        } catch (error) {
          console.error("Apple IAP: receipt fulfillment failed", error);
        }
      });

      await store.initialize();
      initialized = true;
    } catch (error) {
      console.error("Apple IAP: initialization failed", error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Extract a plain-JSON transaction payload from a cdv-purchase Transaction.
 */
function normalizeTransaction(transaction) {
  if (!transaction) return null;
  const productId = transaction.productId || "";
  const plan = applePlanFromProductId(productId);
  if (!plan) return null;

  const expirationDate = transaction.expirationDate;
  const expirationIso =
    expirationDate instanceof Date
      ? expirationDate.toISOString()
      : typeof expirationDate === "number"
        ? new Date(expirationDate).toISOString()
        : null;

  const purchaseDate = transaction.transactionDate;
  const purchaseIso =
    purchaseDate instanceof Date
      ? purchaseDate.toISOString()
      : typeof purchaseDate === "number"
        ? new Date(purchaseDate).toISOString()
        : new Date().toISOString();

  return {
    productId,
    plan: plan.plan,
    billingPeriod: plan.billingPeriod,
    transactionId: transaction.transactionId || "",
    originalTransactionId: transaction.originalTransactionId || transaction.transactionId || "",
    purchaseDate: purchaseIso,
    expirationDate: expirationIso,
    jwsRepresentation: transaction.jwsRepresentation || "",
  };
}

/**
 * Get the list of registered Apple products with localized pricing.
 * Returns an empty array on web.
 */
export async function getAppleProducts() {
  if (!isAppleIAPAvailable() || !initialized) return [];
  try {
    const { store } = await loadStoreModule();
    return APPLE_PRODUCT_IDS.map((id) => store.get(id)).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Initiate a subscription purchase for the given Apple product ID.
 * The result arrives asynchronously via the `verified` listener.
 */
export async function purchaseAppleProduct(productId) {
  if (!isAppleIAPAvailable()) throw new Error("Apple IAP is not available on this device");
  if (!initialized) throw new Error("Apple IAP store has not been initialized");
  const { store } = await loadStoreModule();
  const product = store.get(productId);
  if (!product) throw new Error(`Apple product not found: ${productId}`);
  await store.order(product);
}

/**
 * Restore previous purchases. Triggers the `verified` listener for each
 * restorable transaction.
 */
export async function restoreApplePurchases() {
  if (!isAppleIAPAvailable() || !initialized) return;
  const { store } = await loadStoreModule();
  await store.restorePurchases();
}

/**
 * Open the iOS subscription management sheet (Settings.app deep link).
 */
export async function manageAppleSubscriptions() {
  if (!isAppleIAPAvailable() || !initialized) return;
  const { store } = await loadStoreModule();
  await store.manageSubscriptions();
}