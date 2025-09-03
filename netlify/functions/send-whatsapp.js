// netlify/functions/send-whatsapp.js
const twilio = require('twilio');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { to, body, contentSid, contentVariables } = JSON.parse(event.body || '{}');
    if (!to || (!body && !contentSid)) {
      return { statusCode: 400, body: 'Missing to and message content' };
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return { statusCode: 500, body: 'Twilio credentials not configured' };
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Use your Sandbox sender from Twilio Console
    const FROM = 'whatsapp:+14155238886';

    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const params = { from: FROM, to: toWhatsApp };
    if (contentSid) {
      params.contentSid = contentSid;
      if (contentVariables) params.contentVariables = JSON.stringify(contentVariables);
    } else {
      params.body = body;
    }

    const msg = await client.messages.create(params);
    return { statusCode: 200, body: JSON.stringify({ sid: msg.sid }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
