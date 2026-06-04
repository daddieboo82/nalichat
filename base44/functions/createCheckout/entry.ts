Deno.serve(async (req) => {
  try {
    const { items, callbackUrls } = await req.json();

    const WIX_API_KEY = Deno.env.get("WIX_PAYMENTS_API_KEY");
    const WIX_SITE_ID = Deno.env.get("WIX_PAYMENTS_SITE_ID");

    if (!WIX_API_KEY || !WIX_SITE_ID) {
      return Response.json(
        { error: "Missing Wix Payments configuration" },
        { status: 500 }
      );
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "Items array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate callback URLs
    if (!callbackUrls?.thankYouPageUrl || !callbackUrls?.postFlowUrl) {
      return Response.json(
        { error: "Both thankYouPageUrl and postFlowUrl are required" },
        { status: 400 }
      );
    }

    const formattedItems = items.map(item => ({
      ...item,
      price: String(item.price)
    }));

    const payload = {
      cart: { items: formattedItems },
      callbackUrls,
    };

    const response = await fetch(
      "https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": WIX_API_KEY,
          "wix-site-id": WIX_SITE_ID,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Wix Payments API error:", data);
      return Response.json(
        { error: data.message || "Failed to create checkout session" },
        { status: response.status }
      );
    }

    return Response.json({
      checkoutUrl: data.checkoutSession.redirectUrl,
      checkoutId: data.checkoutSession.id,
    });
  } catch (error) {
    console.error("Checkout error:", error.message);
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
});