// netlify/functions/send-whatsapp.js
const twilio = require('twilio');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const { to, body } = JSON.parse(event.body || '{}');
    if (!to || !body) {
      return { statusCode: 400, body: 'Missing to or body' };
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return { statusCode: 500, body: 'Twilio credentials not configured' };
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Use the Sandbox sender from your Twilio Console (common: +14155238886)
    const FROM = 'whatsapp:+14155238886'; // replace if your console shows a different sandbox sender [2]

    // Ensure the "to" is prefixed with whatsapp:
    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const msg = await client.messages.create({
      from: FROM,
      to: toWhatsApp,
      body, // sandbox allows free-form text inside an active session; templates needed in production outside 24h [5]
    });

    return { statusCode: 200, body: JSON.stringify({ sid: msg.sid }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
