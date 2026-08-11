# HorizonSky

A flight-search lead-generation website: search flights → get a live-loading quote →
request a personalized quote through a sticky contact form → data is saved to a
real SQLite database, with a fallback "connect with an agent" toast when the
phone/email entered looks fake.

## What's inside

```
HorizonSky/
├── server.js          Express backend (search + leads API)
├── db.js              SQLite persistence (Node's built-in node:sqlite)
├── email.js            Emails every new lead to horizonsky370@gmail.com
├── validation.js       Email / phone plausibility checks
├── package.json
├── .env.example         Copy to .env to configure SMTP + other settings
└── public/
    ├── index.html      Main site
    ├── about.html, flights.html, hotels.html, deals.html,
    │   contact.html, careers.html, press.html, faqs.html,
    │   manage-booking.html, privacy.html, terms.html,
    │   cookie-preferences.html, sitemap.html
    │                    Simple placeholder pages linked from the nav/footer
    ├── admin.html       Read-only leads dashboard (demo/testing)
    ├── css/style.css
    ├── js/app.js         All front-end interaction logic
    └── assets/           Logo + favicon files
```

## Running it

Requires **Node.js 22.5+** (uses the built-in `node:sqlite` module — no native
build step, no external database to install).

```bash
npm install
npm start
```

To enable email notifications, copy `.env.example` to `.env` and fill in
real SMTP credentials first — see **Email notifications** below. The site
runs fine without it; leads are still stored in the database, and a warning
is logged instead of an email being sent.

Then open:
- **Site:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin.html (key: `horizonsky-admin`,
  or whatever you set the `ADMIN_KEY` environment variable to)

The database file `horizonsky.db` is created automatically in the project root
the first time the server runs.

## How the flow works

1. **Search** — visitor fills in the hero search form (From / To / dates /
   passengers) and submits.
2. **Loading** — the page scrolls to a two-column quote layout: the left card
   shows an animated "searching" progress bar, the right card is a sticky
   "Get the Best Quote Guaranteed" contact form (pre-filled with the same
   route). Both sit side by side, matching the reference layout.
3. **Results** — once `/api/search` responds (and a minimum ~2.4s has
   elapsed, so it never feels instant/fake), the left card swaps to show a
   discounted price, trust badges, and partner airline names.
4. **Quote request** — submitting the right-panel form calls `/api/leads`,
   which validates the email/phone and stores the submission (valid or not)
   in SQLite. The left card always swaps to a "Thank you for the request!"
   confirmation with social links.
5. **Fallback toast** — if the server flagged the phone or email as
   implausible (placeholder domains, repeated/sequential digits, wrong
   length, etc.), a toast appears in the bottom-right a few seconds later:
   *"We attempted to reach you by [phone/email] but were unable to connect...
   click 'Connect with Agent'..."* The button links to the same phone number
   shown at the top of the quote form.
6. **Email notification** — at the same time, `email.js` sends the full
   submission (route, dates, contact info, quoted price, and whether the
   contact info was flagged) to **horizonsky370@gmail.com**. This happens
   in the background and never blocks or fails the form submission, even if
   email delivery fails.

## Email notifications

Every lead is emailed to `horizonsky370@gmail.com` (override with
`LEAD_NOTIFY_EMAIL` in `.env`) via `email.js`, using
[nodemailer](https://nodemailer.com/) under the hood.

1. Copy `.env.example` to `.env`.
2. Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (and
   `SMTP_SECURE`/`SMTP_FROM` if needed).
3. Restart the server (`npm start`).

**Using Gmail to send:** go to your Google Account → Security → 2-Step
Verification → App Passwords, generate a 16-character app password, and use
that as `SMTP_PASS` (a normal Gmail password will not work). Any other SMTP
provider — SendGrid, Mailgun, Amazon SES, your own mail server — works the
same way, just point `SMTP_HOST`/`SMTP_PORT` at it.

If SMTP isn't configured, the server logs a one-time warning and skips
sending — the quote request is still saved to the database and the visitor
still sees the normal thank-you confirmation either way.

## Customizing

- **Phone number / promo code**: search for `+44 20 4617 6370` (and the
  matching `tel:+442046176370` links) and `SKY30` in `public/index.html`
  and `public/js/app.js` if you need to change them.
- **Partner airline names**: `AIRLINE_PARTNERS` in `server.js`.
- **Pricing logic**: `buildQuote()` in `server.js` — currently a
  deterministic mock based on the route name so demos are repeatable; wire
  this up to a real flight-search API when you're ready to go live.
- **"Fake info" detection rules**: `validation.js` — domain/pattern
  blocklists for email, digit-pattern checks for phone.
- **Colors / fonts**: CSS custom properties at the top of
  `public/css/style.css`.
- **Placeholder pages**: `about.html`, `contact.html`, `flights.html`, etc.
  are intentionally simple "coming soon" pages so every nav/footer link
  resolves to a real page. Edit them directly (they don't share a template
  file — the header/footer markup is duplicated in each, matching
  `index.html`) or replace them with fully built-out pages whenever you're
  ready.

## Notes for production

- `admin.html` / `/api/leads` (GET) use a single shared key
  (`x-admin-key` header) for simplicity — replace with real authentication
  before deploying publicly.
- `node:sqlite` is still an experimental Node API (hence the startup
  warning); it's stable enough for this use case, but swap in
  `better-sqlite3` or a hosted database if you need broader Node-version
  support or multi-server deployments.
