const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Where lead notifications get sent. Override with LEAD_NOTIFY_EMAIL if you
// ever need to point this at a different inbox.
// ---------------------------------------------------------------------------
const NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || 'horizonsky370@gmail.com';

// ---------------------------------------------------------------------------
// SMTP transport — configured entirely through environment variables so no
// credentials ever live in source control. See README.md for setup steps
// (e.g. a Gmail address + App Password, or any other SMTP provider).
//
// Required env vars:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Optional:
//   SMTP_SECURE   ("true" for port 465, otherwise leave unset)
//   SMTP_FROM     defaults to SMTP_USER
// ---------------------------------------------------------------------------
let transporter = null;
let configWarningShown = false;

function isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
    if (!isConfigured()) return null;
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    return transporter;
}

function esc(value) {
    return String(value ?? '—').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function buildEmailHtml(lead) {
    const statusBadge = lead.is_valid
        ? '<span style="background:#E9F9EE;color:#1E8E3E;padding:3px 10px;border-radius:50px;font-size:12px;font-weight:700;">Contact info looks valid</span>'
        : `<span style="background:#FFF6E0;color:#B8860B;padding:3px 10px;border-radius:50px;font-size:12px;font-weight:700;">Flagged: ${esc(lead.invalid_field)} looks fake (${esc(lead.invalid_reason)})</span>`;

    const row = (label, value) => `
        <tr>
            <td style="padding:8px 12px;color:#666;font-size:13px;font-weight:600;white-space:nowrap;">${esc(label)}</td>
            <td style="padding:8px 12px;color:#333;font-size:13px;">${esc(value)}</td>
        </tr>`;

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#0A3D91;padding:20px 24px;border-radius:12px 12px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:18px;">New Quote Request — HorizonSky</h2>
        </div>
        <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px;">
            <p style="margin:0 0 14px;">${statusBadge}</p>
            <table style="width:100%;border-collapse:collapse;">
                ${row('Name', lead.name)}
                ${row('Email', lead.email)}
                ${row('Phone', `${lead.country_code || ''} ${lead.phone || ''}`.trim())}
                ${row('From', lead.from_city)}
                ${row('To', lead.to_city)}
                ${row('Depart', lead.depart_date)}
                ${row('Return', lead.return_date)}
                ${row('Passengers', lead.passengers)}
                ${row('Hotel needed', lead.hotel_needed ? 'Yes' : 'No')}
                ${row('Quoted price', lead.quoted_price)}
                ${row('Submitted', lead.created_at)}
            </table>
            <p style="margin-top:18px;font-size:12px;color:#999;">
                Lead #${esc(lead.id)} · Stored in horizonsky.db · View all leads at /admin.html
            </p>
        </div>
    </div>`;
}

function buildEmailText(lead) {
    return [
        'New Quote Request — HorizonSky',
        `Status: ${lead.is_valid ? 'Contact info looks valid' : `Flagged (${lead.invalid_field}: ${lead.invalid_reason})`}`,
        `Name: ${lead.name || '—'}`,
        `Email: ${lead.email || '—'}`,
        `Phone: ${(lead.country_code || '')} ${lead.phone || '—'}`,
        `From: ${lead.from_city || '—'}`,
        `To: ${lead.to_city || '—'}`,
        `Depart: ${lead.depart_date || '—'}`,
        `Return: ${lead.return_date || '—'}`,
        `Passengers: ${lead.passengers || '—'}`,
        `Hotel needed: ${lead.hotel_needed ? 'Yes' : 'No'}`,
        `Quoted price: ${lead.quoted_price || '—'}`,
        `Submitted: ${lead.created_at || '—'}`,
        `Lead #${lead.id}`
    ].join('\n');
}

/**
 * Fire-and-forget email notification for a newly stored lead.
 * Never throws — a missing SMTP config or a delivery failure should never
 * break the /api/leads request/response cycle.
 */
async function sendLeadNotification(lead) {
    const t = getTransporter();

    if (!t) {
        if (!configWarningShown) {
            console.warn(
                '\n [email.js] SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS env vars ' +
                'missing) — skipping email notification. See README.md to enable it.\n'
            );
            configWarningShown = true;
        }
        return { sent: false, reason: 'not_configured' };
    }

    try {
        await t.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: NOTIFY_EMAIL,
            replyTo: lead.email || undefined,
            subject: `New Quote Request: ${lead.from_city || '?'} → ${lead.to_city || '?'}${lead.is_valid ? '' : ' (⚠ unreachable contact info)'}`,
            text: buildEmailText(lead),
            html: buildEmailHtml(lead)
        });
        console.log(` [email.js] Lead #${lead.id} emailed to ${NOTIFY_EMAIL}`);
        return { sent: true };
    } catch (err) {
        console.error(` [email.js] Failed to email lead #${lead.id}:`, err.message);
        return { sent: false, reason: 'send_error', error: err.message };
    }
}

module.exports = { sendLeadNotification, isConfigured, NOTIFY_EMAIL };
