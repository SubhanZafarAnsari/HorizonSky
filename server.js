require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const { isValidEmail, isValidPhone } = require('./validation');
const { sendLeadNotification } = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'horizonsky-admin';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Simple deterministic "mock" pricing engine, so the same route always
// quotes the same headline numbers (keeps the demo believable / repeatable).
// ---------------------------------------------------------------------------
const AIRLINE_PARTNERS = [
  { name: 'Pinnacle Air', tag: 'Prestige Carrier' },
  { name: 'Meridian Alliance', tag: 'Global Network' },
  { name: 'Continental Wings', tag: 'Partner Airline' }
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildQuote(from, to) {
  const seed = hashString(`${(from || '').toLowerCase()}|${(to || '').toLowerCase()}`);
  const basePrice = 420 + (seed % 900); // $420 - $1319
  const discountPercent = 18 + (seed % 15); // 18% - 32%
  const discountedPrice = Math.round(basePrice * (1 - discountPercent / 100));
  const savings = basePrice - discountedPrice;

  return {
    originalPrice: basePrice,
    price: discountedPrice,
    savings,
    savingsPercent: Math.round((savings / basePrice) * 100),
    airlines: AIRLINE_PARTNERS
  };
}

function airportCode(cityText) {
  const cleaned = String(cityText || '').replace(/[^a-zA-Z ]/g, '').trim();
  if (!cleaned) return '---';
  const words = cleaned.split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

// ---------------------------------------------------------------------------
// API: Search — returns a mock quote for the route. (DB logging removed)
// ---------------------------------------------------------------------------
app.post('/api/search', (req, res) => {
  const { from, to, departDate, returnDate, passengers } = req.body || {};

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  const quote = buildQuote(from, to);

  console.log(`\n Search: ${from} -> ${to} | quoted $${quote.price} (was $${quote.originalPrice})`);

  // Small artificial delay so the loading state feels real, even on
  // localhost where the response would otherwise be instant.
  setTimeout(() => {
    res.json({
      from: { raw: from, code: airportCode(from) },
      to: { raw: to, code: airportCode(to) },
      departDate: departDate || null,
      returnDate: returnDate || null,
      passengers: passengers || '2_adults_economy',
      ...quote
    });
  }, 900);
});

// ---------------------------------------------------------------------------
// API: Leads — validates + emails a quote request from the sticky form.
// (DB storage removed — this is now a stateless notify-only endpoint.)
// ---------------------------------------------------------------------------
app.post('/api/leads', (req, res) => {
  const {
    from, to, departDate, returnDate, passengers,
    name, email, phone, countryCode, hotelNeeded, quotedPrice
  } = req.body || {};

  if (!from || !to || !email || !phone) {
    return res.status(400).json({ error: 'from, to, email and phone are required' });
  }

  const emailCheck = isValidEmail(email);
  const phoneCheck = isValidPhone(phone);

  // Phone is checked first: these lead-gen flows try to *call* the person,
  // so a bad phone number is the more relevant failure to surface.
  let invalidField = null;
  let invalidValue = null;

  if (!phoneCheck.valid) {
    invalidField = 'phone';
    invalidValue = `${countryCode || ''} ${phone}`.trim();
  } else if (!emailCheck.valid) {
    invalidField = 'email';
    invalidValue = email;
  }

  const isValid = !invalidField;

  const lead = {
    from_city: from,
    to_city: to,
    depart_date: departDate,
    return_date: returnDate,
    passengers,
    name,
    email,
    phone,
    country_code: countryCode,
    hotel_needed: !!hotelNeeded,
    quoted_price: quotedPrice,
    is_valid: isValid,
    invalid_field: invalidField,
    invalid_reason: isValid ? null : (invalidField === 'phone' ? phoneCheck.reason : emailCheck.reason),
    invalid_value: invalidValue
  };

  console.log(`\n New lead: ${name || '(no name)'} | ${email} | ${countryCode || ''}${phone} | valid=${isValid}`);

  // Fire-and-forget: email the lead to the inbox without delaying the
  // response back to the browser, and without ever failing the request
  // if SMTP isn't configured or delivery fails.
  sendLeadNotification(lead);

  res.json({
    success: true,
    valid: isValid,
    invalidField,
    invalidValue
  });
});

app.listen(PORT, () => {
  console.log(`\n HorizonSky server running: http://localhost:${PORT}\n`);
});