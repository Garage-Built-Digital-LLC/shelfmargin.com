# Amazon Professional Month Plan

ShelfMargin should treat the Amazon Professional selling plan as a one-month
validation window, not a permanent cost we assume the business can carry.

The monthly cost is roughly $40. The purpose of paying for one month is to prove
whether live Amazon data makes the scanner valuable enough to justify both the
Amazon cost and ShelfMargin's planned paid pricing.

## Before Paying

- Confirm the Amazon seller account is active.
- Confirm the account can access the developer area after upgrading to
  Professional.
- Keep the Amazon environment variable slots ready in `.env.local`.
- Keep all Amazon credentials out of docs, screenshots, chat, and git.
- Prepare 20 to 50 real books for the first live scanner test.
- Prepare a larger 100-book sourcing test if the first test works.

## Day 0

- Upgrade the Amazon seller account to Professional only when ready to work.
- Open the Amazon developer app for ShelfMargin.
- Get the LWA client ID.
- Get the LWA client secret.
- Generate the refresh token through the private-app authorization flow.
- Add those values to `.env.local`.
- Rebuild local Docker with `.env.local`.
- Sign in as admin and run the Amazon connection test.

## Week 1

- Prove the backend can exchange the refresh token for an access token.
- Add a server-side Amazon lookup path for ISBN input.
- Test at least 10 real ISBNs.
- Confirm the Amazon lookup returns the right title and ASIN before using it for
  pricing decisions.
- Record whether Amazon returns the correct title, offer data, and useful
  restrictions or sales-rank signals.
- Keep the scanner UI honest if any field is still estimated or missing.

## Week 2

- Convert live Amazon responses into the scan decision model.
- Show the user which parts are live and which parts are still estimated.
- Add useful fallback messages when Amazon has no match, no offer data, or
  restricted data.
- Export live-test evidence for review.

## Week 3

- Run a real sourcing test with 50 to 100 books.
- Track scan time per book.
- Track lookup success rate.
- Track how many books are buy, pass, and check.
- Track how often the app decision matched the later manual review.
- Track how many books were saved to the buy list and exported.

## Week 4 Decision

Keep the Amazon Professional plan only if:

- Live Amazon data is accessible and stable enough for the scanner.
- The scanner materially saves time during real sourcing.
- The estimates are close enough to prevent bad buys or find good buys.
- The workflow can support the planned $15/month Starter and $29/month Pro
  pricing.

Cancel or pause the Amazon Professional plan if:

- Developer access remains blocked.
- Amazon data is too limited for book-sourcing decisions.
- The workflow is slower than manual checking.
- Field testing does not show enough saved time or avoided mistakes to justify
  the monthly cost.

## Proof Metrics

- Books scanned.
- Seconds per scan.
- Amazon lookup success rate.
- Title match rate.
- Books saved to the buy list.
- CSV exports.
- Manual review pass/fail rate.
- Difference between app estimate and manual check.
- Number of clear buys found.
- Number of bad buys avoided.

## Boundary

The one-month goal is proof, not polish. During this window, prioritize live
Amazon connectivity, correct scanner behavior, realistic estimates, field-test
evidence, and a clear keep-or-cancel decision.
