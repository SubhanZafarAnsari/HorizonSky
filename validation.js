// Lightweight plausibility checks used to flag obviously fake contact info
// entered in the quote request form. These are NOT meant to be a bulletproof
// verification system (that would require an actual phone/email verification
// provider) - they catch the common "junk data" patterns so the agent-connect
// fallback can be triggered.

const FAKE_EMAIL_DOMAINS = new Set([
  'test.com', 'example.com', 'fake.com', 'asdf.com', 'none.com',
  'notreal.com', 'abc.com', 'xyz.com', 'noemail.com', 'nomail.com',
  'email.com', 'mailinator.com', 'yopmail.com', 'guerrillamail.com',
  'trashmail.com', 'temp-mail.org'
]);

const FAKE_EMAIL_LOCAL_PARTS = new Set([
  'test', 'fake', 'asdf', 'admin', 'none', 'na', 'xx', 'xxx', 'abc',
  'noreply', 'no-reply', 'aaaa', 'asdfasdf', 'qwerty', 'user', 'email',
  'notreal', 'idontknow', 'nobody'
]);

function isValidEmail(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  const basicShape = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!basicShape.test(email)) {
    return { valid: false, reason: 'malformed' };
  }

  const [localPart, domain] = email.split('@');

  if (FAKE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, reason: 'disposable_or_placeholder_domain' };
  }

  if (FAKE_EMAIL_LOCAL_PARTS.has(localPart)) {
    return { valid: false, reason: 'placeholder_local_part' };
  }

  // Repeated single character, e.g. "aaaaaaa@gmail.com"
  if (/^(.)\1+$/.test(localPart)) {
    return { valid: false, reason: 'repeated_character' };
  }

  return { valid: true, reason: null };
}

function isValidPhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, reason: 'wrong_length' };
  }

  // All the same digit, e.g. 0000000000 / 1111111111
  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, reason: 'repeated_digit' };
  }

  // Perfectly sequential ascending or descending, e.g. 1234567890 / 9876543210
  const ascending = '0123456789012345';
  const descending = '9876543210987654';
  if (ascending.includes(digits) || descending.includes(digits)) {
    return { valid: false, reason: 'sequential_digits' };
  }

  return { valid: true, reason: null };
}

module.exports = { isValidEmail, isValidPhone };
