# Amazon SP-API Setup

ShelfMargin is moving to an Amazon-first MVP. Amazon SP-API credentials must stay
server-side and must never be placed in `VITE_*` variables, committed files, or
client-side code.

## Current Status

- Amazon developer profile: approved by Amazon.
- Sandbox app client: created in Solution Provider Portal.
- Seller Central account: approved and active.
- Amazon Professional plan: required for developer access; use the first paid
  month as a validation window.
- Production app client: ready for owner credential setup after Professional
  access is available in Amazon.
- Local backend endpoint: `/api/amazon/status`.
- Admin-only backend test endpoint: `/api/amazon/test`.
- Amazon catalog endpoint: `/api/amazon/catalog?isbn=9780132350884`.
- Live Amazon scan decisions: catalog matching is wired first; pricing and fees
  are still estimated.

## Required Environment Variables

Add these values to `.env.local` only:

```env
AMAZON_SP_API_MODE=sandbox
AMAZON_SP_API_ENDPOINT=https://sandbox.sellingpartnerapi-na.amazon.com
AMAZON_SP_API_MARKETPLACE_ID=ATVPDKIKX0DER
AMAZON_SP_API_LWA_CLIENT_ID=
AMAZON_SP_API_LWA_CLIENT_SECRET=
AMAZON_SP_API_REFRESH_TOKEN=
```

If you only have sandbox credentials, these sandbox-specific aliases also work
while `AMAZON_SP_API_MODE=sandbox`:

```env
AMAZON_SP_API_SANDBOX_LWA_CLIENT_ID=
AMAZON_SP_API_SANDBOX_LWA_CLIENT_SECRET=
AMAZON_SP_API_SANDBOX_REFRESH_TOKEN=
```

Use `AMAZON_SP_API_MODE=production` only after the production app client and
seller authorization are ready.

## After Seller Central Approval

1. Upgrade to Amazon Professional only when ready to work through the paid
   validation month.
2. Open the Amazon Solution Provider Portal or Seller Central developer area.
3. Open the ShelfMargin app client.
4. Copy the LWA client ID.
5. Copy the LWA client secret.
6. Self-authorize the private app to generate the refresh token.
7. Add those three values to `.env.local`.
8. Rebuild local Docker with `.env.local`.
9. Sign in as admin and click **Test Amazon connection**.
10. Start the 50 to 100 book validation test once live lookup works.

## Credential Rules

- Client ID is server-side for this app.
- Client secret is secret.
- Refresh token is secret.
- Access tokens are temporary and should not be stored in the browser.
- The browser should call ShelfMargin server endpoints, not Amazon directly.

## Next Implementation Steps

1. Add Amazon credentials to `.env.local`.
2. Verify `/api/amazon/status` returns `configured: true`.
3. Run the admin-only Amazon token-exchange smoke test.
4. Verify Amazon catalog lookup by ISBN.
5. Add Amazon pricing and fee endpoints after catalog matching works.
6. Keep scan UI labels honest until production data is verified.
