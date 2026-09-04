# Shelf Margin iOS App — Technical Plan

Companion to `docs/IOS_APP_BUILD_PLAN.md` (the 2-week sprint). That doc says *when*;
this doc says *how* and *what to consider* across front end, back end, security, assets,
and user data. Framework is Expo / React Native; the app is a thin native client over the
existing Supabase + Node backend, which stays the source of truth.

## Guiding Principles

- Reuse the backend and the pure logic; rebuild only the UI shell. No new data model.
- The webapp owns accounts, history, billing, exports, and Amazon integration. iOS is a
  second surface that reads and writes the same rows.
- Keep the buy / check / pass decision identical across web and iOS by sharing `profit.js`.
- Keep estimated-vs-live Amazon data honest on every screen.
- Ship narrow. Anything not required for sign-in → scan → decide → save → sync is v1.1.

---

## 1. Front End

### Screens (derived from the webapp shell in `Ledger.jsx`)

- Auth: sign in / sign up / sign out, persisted session, password rules matching web.
- Scan: the primary screen — live camera viewfinder + a hidden focused input for Bluetooth
  scanners, a manual ISBN entry fallback, and immediate result feedback.
- Result: reuse of `ResultCard` semantics — decision (buy/check/pass), estimated profit,
  best-channel net (Amazon vs eBay), velocity badge, data-source/estimate badges, one reason.
- Buy list / history (the "Ledger"): saved scans, copy counts / duplicate detection,
  session summaries, per-book check notes. Read/write the same `scans` and
  `scan_verifications` rows.
- Settings: cost-per-book and minimum-profit threshold (feeds `profit.js` `settings`),
  plan/trial status (read-only), account actions (export request, delete account).

### Component + logic reuse map

- Reuse directly (pure JS, no DOM): `isbn.js`, `profit.js` (`evaluate`, `amazonNet`,
  `ebayNet`, `velocityBucket`, `DEFAULT_FEE_MODEL`, `DEFAULT_VELOCITY_THRESHOLDS`),
  `pricing.js`, `sessionSummary.js`, `providers/types.js`.
- Reuse with a swapped storage/client: `supabase.js` (Expo SecureStore session adapter),
  `scansRepo.js` (`currentUserId`, `getProfile`, `updateProfile`, `fetchScans`, `insertScan`,
  `updateScan`, `deleteAllScans`, `fetchScanVerifications`, `upsertScanVerification`) — same
  queries, RN Supabase client.
- Rebuild for native (was DOM/JSX-for-web): the screens themselves, navigation, the camera
  viewfinder, and the sound/haptic layer (`sounds.js` uses the web Audio API → replace with
  `expo-haptics` + `expo-av`).
- Do not port to v1: admin tools, CSV export UI (export stays server/web), Stripe checkout UI,
  the public SEO site.

### Scanning UX (both inputs in v1)

- Camera: `expo-camera` reading EAN-13 barcodes → normalize with `isbn.js` → lookup. Debounce
  so one physical barcode fires one lookup; show a clear scanned/duplicate state; keep the
  viewfinder responsive (scanning is the product, latency is the enemy).
- Bluetooth scanner: pairs as an HID keyboard. Capture with an always-focused hidden input,
  submit on Enter — the same model the webapp already uses. Let the user toggle camera vs
  scanner or auto-detect keyboard input.
- Manual entry fallback for damaged/absent barcodes.
- Feedback: distinct haptic + sound per decision (buy/check/pass) so the user can keep moving
  without staring at the screen — this is also the seed of the future Watch experience.

### State, navigation, offline

- Navigation: a small stack + tab structure (Expo Router or React Navigation). Keep it flat;
  the scan screen is home.
- State: local component state + a light store (Zustand or context) for session, settings, and
  the in-memory scan session. No heavy state library needed for v1.
- Offline behavior: scanning in a warehouse or thrift store often has poor signal. v1 should at
  minimum cache the session locally and queue writes; a full offline-first sync is a v1.1
  candidate (see User Data → Offline & sync).

---

## 2. Back End

No new backend product — the app consumes what exists. What must change is small but real.

### API surface the app calls

- `GET /api/catalog?isbn=…` → the `BookData` shape in `providers/types.js` (title, author,
  amazonPrice/BSR estimates, gated flag, sources). This keeps Amazon credentials server-side.
- `GET /api/amazon/catalog?isbn=…` and `GET /api/amazon/status` for the live-Amazon path.
- Supabase directly (via the RN client) for auth and for `scans` / `scan_verifications` /
  `profiles` / `billing_accounts` reads and writes, all under RLS.
- Stripe stays server-side and web-facing for v1 (`/api/stripe/*`); the app only reads billing
  status.

### Required backend changes for mobile

1. Stable hosted API base URL. Today the webapp calls `/api/*` same-origin. The native app needs
   an absolute `API_BASE_URL`. Deploy `server.mjs` (Vercel or the existing Dockerfile host) to a
   fixed HTTPS URL and configure the app per environment (dev/prod).
2. CORS / allowed origins for native requests to `/api/*`.
3. Confirm the catalog and Amazon endpoints behave identically when called cross-origin from the
   app, including the existing rate-limit buckets.
4. Keep the hardened 500 handler (already done in the security pass) so errors never leak Amazon
   status/keys to the client.

### Sync model

- Sync is implicit: web and iOS write the same Supabase rows scoped by `user_id`, so a scan saved
  on the phone appears in the webapp Ledger and vice versa, no extra sync service. The only real
  work is handling the offline → online write queue on the app side.

---

## 3. Security

The strong posture already documented in `docs/SECURITY_AUDIT.md` and project memory carries over,
because the app relies on the same RLS and server boundaries. Mobile-specific additions:

- Token storage: store the Supabase session in the iOS Keychain via `expo-secure-store`, never in
  plain AsyncStorage. Sessions must survive app restarts but stay OS-protected.
- Transport: HTTPS only, App Transport Security left at its secure defaults (no arbitrary-loads
  exception). The API base URL must be TLS.
- No secrets in the app bundle: the Supabase anon key and API base URL are fine to ship (anon key
  is public by design and gated by RLS). The service-role key, Stripe secret, and Amazon LWA
  secrets never touch the client — they stay in server env vars, exactly as the OWNER_INPUTS doc
  requires.
- RLS is the real access control: every `scans` / `scan_verifications` / `profiles` /
  `billing_accounts` row is scoped to `auth.uid()`, and column GRANTs block overposting of role /
  subscription_status / trial_scans_used. The app cannot escalate because the database won't let it.
- Auth hardening (pending, from the security runbook): leaked-password protection (HaveIBeenPwned),
  server-side password minimum, and TOTP MFA. None block the beta; all should be closed before
  public App Store launch. If MFA lands, the app needs an enroll/verify screen.
- Rate limiting: the sensitive-endpoint bucket (account export/delete, Amazon test) already exists;
  make sure the app respects and surfaces rate-limit responses gracefully.
- Client-side validation is convenience only — treat the server and RLS as the sole trust boundary.
- Lower priority for v1: jailbreak/tamper detection and certificate pinning. Note them, don't build
  them yet.

---

## 4. Assets

- App icon: 1024×1024 master + the adaptive/rounded variants Expo generates. Needs the Shelf
  Margin brand mark (there's a `BrandMark` in `Ledger.jsx` and brand assets under `docs/assets/`
  and `public/` to derive from).
- Splash / launch screen: brand mark on the app background; keep it instant.
- Sounds + haptics: per-decision cues (buy/check/pass). Source short audio files and map them the
  way `sounds.js` maps `playForStatus`, but via `expo-av`; pair each with an `expo-haptics` pattern.
- Fonts: reuse the webapp's type choices for brand consistency; bundle via `expo-font` if not a
  system font.
- Marketing assets (needed later for App Store, not for TestFlight): screenshots for required
  device sizes, a short preview, app description, keywords, and a support URL
  (`support@shelfmargin.com` is already chosen).
- Legal/store pages: reuse the webapp's `/privacy` and terms; the App Store privacy questionnaire
  will reference them.

---

## 5. User Data

### What data exists and where it lives

- `profiles` — user settings incl. cost-per-book and profit threshold, role, trial usage.
- `scans` — every saved scan (ISBN, resolved title/author, estimates, decision, timestamps).
- `scan_verifications` — the "book check" notes / real-price confirmations per scan.
- `billing_accounts` — plan and subscription status; app-read-only, service-role-written.
- All of the above are RLS-scoped to the owning user; the app reads/writes them through
  `scansRepo.js` under the user's own token.

### Offline & sync (the main mobile-specific data problem)

- Sourcing happens where signal is bad. v1 minimum: keep the active scan session in local state so
  a dropped connection doesn't lose work, and queue `insertScan` / `upsertScanVerification` writes
  to retry when back online.
- Because rows are keyed by `user_id` and written to the same tables, once a queued write lands it
  simply appears on web too — no conflict resolution service needed. Use client-generated stable ids
  and idempotent upserts to avoid duplicates on retry.
- Full local-first mirroring (e.g. a local DB that always reflects the cloud) is a v1.1 upgrade,
  not a beta requirement.

### Privacy, deletion, export

- Account deletion already exists server-side: `delete_own_account()` (migration 0009) plus
  `POST /api/account/delete`, scoped to the caller's own token and cascading their rows. The app
  must expose a "Delete account" action that calls it — Apple's guidelines require in-app account
  deletion for apps that support account creation, so this is not optional for App Store.
- Data export already exists: `GET /api/account/export`. Surface it as "Export my data".
- Data minimization: the app collects only what sourcing needs (email for auth, scans, settings).
  No location, contacts, or tracking in v1 — which keeps the App Store privacy questionnaire simple
  and truthful.
- PII: email is the main personal datum; it lives in Supabase Auth. Don't log it, don't put it in
  crash reports.
- Privacy "nutrition label": plan to declare exactly what's collected (email, app usage), that it's
  linked to the user, and that it is not used for tracking. Keep this consistent with the real
  behavior.

---

## 6. Cross-Cutting — What Else To Consider

- App Store review realities: in-app account deletion (covered above); no private APIs; a working
  demo account for reviewers; honest data/pricing claims. Keeping paid upgrades on the web for v1
  sidesteps Apple's In-App-Purchase requirement — revisit deliberately if/when you want in-app plans.
- Environment config: separate dev vs prod for `API_BASE_URL` and the Supabase project; use Expo's
  env/config so no URL or key is hardcoded per build.
- OTA updates: EAS Update lets you push JS-only fixes without a new App Store review — very valuable
  during a fast beta. Native changes still need a rebuild.
- Crash + error reporting: add lightweight crash reporting (e.g. Sentry) early so beta issues are
  visible; scrub PII from reports.
- Analytics: minimal and privacy-respecting — enough to measure the metrics the roadmap cares about
  (scan success rate, title-match rate, buy-list saves, repeat use), nothing that complicates the
  privacy label.
- Testing: reuse the existing vitest suite for the shared pure logic (`profit.js`, `isbn.js` are
  already covered); add a thin layer of component/interaction tests for the scan flow. Real-book
  field testing (20–50 scans) is the decisive test, per the roadmap.
- Performance: scan-to-result latency is the product's heartbeat. Debounce scans, cache recent
  lookups in-session, and keep the camera frame loop smooth.
- Accessibility: legible decision text, sufficient contrast, VoiceOver labels on the core actions —
  cheap to do from the start, expensive to retrofit.
- Versioning: semantic app versions + build numbers wired into EAS from day 1 so TestFlight builds
  are traceable.

---

## Open Owner Decisions

- Confirm the API hosting target (Vercel vs the existing Docker host) so the app gets a stable URL.
- Provide the Bluetooth scanner model used for field tests.
- Set the two decision inputs: average cost per book and minimum profit worth buying.
- Confirm whether v1 needs eBay shown alongside Amazon, or Amazon-only for the first beta.
- Apple Developer enrollment: defer until close to TestFlight, per owner decision (start it a few
  days before the Day 9 build so approval lands in time).
