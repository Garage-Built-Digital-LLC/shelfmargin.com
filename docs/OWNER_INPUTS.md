# Shelf Margin Owner Inputs

These are the items the project owner needs to provide, decide, or test directly.
They are separate from engineering todos because they require real accounts,
real books, business decisions, or external service access.

## Done

- Created the first real Shelf Margin account: `dillonw@garagebuiltdigital.com`.
- Confirmed that account is email-confirmed and has the `admin` role.
- Chose planned public support email: `support@shelfmargin.com`.
- Chose initial pricing: 100-book lifetime free per account, then $15/month Starter or $29/month Pro to keep scanning. No team plan yet.
- Chose Apple Watch alerts as a future paid feature.
- Confirmed real books are available for field testing.

## Needed Now

- Sign in with `dillonw@garagebuiltdigital.com`.
- Confirm the admin badge shows next to the email in the app.
- Treat the Amazon Professional plan as a one-month validation cost and cancel
  it if live scanner proof does not justify keeping it.
- Once Professional access is active, generate the Amazon LWA client ID, client
  secret, and refresh token.
- Use Scanner Test to confirm the barcode scanner sends one complete ISBN and presses Enter.
- Scan 20 to 50 real books with the barcode scanner you plan to use.
- Record whether each real scan matched the title on the physical book.
- Set the real average cost per book.
- Set the minimum profit that makes a book worth buying.
- Check app estimates against real Amazon data before buying.
- Use Amazon as the first live data source.
- Provide any marketplace API credentials only through server-side environment variables.
- Secure the `shelfmargin.com` domain.
- Activate the `support@shelfmargin.com` inbox before public launch.
- Create or confirm Stripe test-mode products and recurring monthly prices for
  Starter (`shelfmargin_starter_monthly`) and Pro (`shelfmargin_pro_monthly`)
  before turning on live checkout.
- Provide Stripe webhook signing secret only through server-side environment
  variables. Checkout and webhooks fail closed until this is set.
- Decide whether the first iOS app should prioritize phone camera scanning,
  Bluetooth scanner input, or both.
- Confirm Apple Developer Program enrollment before App Store release work.

## Do Not Put In The Browser App

- Supabase service role key.
- Marketplace API secrets.
- Stripe secret key.
- Personal passwords.
- Private customer data that is not needed for testing.
