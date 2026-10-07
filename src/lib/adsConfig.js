// Google AdSense configuration
//
// To turn on ads and start earning from site visits:
// 1. Sign up at https://www.google.com/adsense/start/
// 2. Add your site URL (https://nalichat.base44.app or your custom domain)
// 3. Wait for Google to approve your site (can take days to weeks)
// 4. Copy your publisher ID — it looks like: ca-pub-1234567890123456
// 5. Paste it below as the ADSENSE_CLIENT_ID value
//
// Until you paste a real ID, ADS_ENABLED stays false and no ad code runs —
// the site looks exactly as it does now. The moment you add the ID and
// redeploy, tasteful ad units appear in the Explore feed and page footers.

export const ADSENSE_CLIENT_ID = "ca-pub-5082975841765206";

export const ADS_ENABLED = Boolean(
  ADSENSE_CLIENT_ID && ADSENSE_CLIENT_ID.startsWith("ca-pub-")
);