const PRODUCTION_WEBHOOK_URL = 'https://farzadbehzadi.app.n8n.cloud/webhook/contact-form';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const fullName = (body.fullName || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const phone = (body.phone || '').toString().trim();
  const message = (body.message || '').toString().trim();

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Full name and email are required.' });
  }

  const webhookUrl = process.env.BOOKING_WEBHOOK_URL || PRODUCTION_WEBHOOK_URL;

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, message })
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook responded with status ${webhookResponse.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form webhook error:', err);
    return res.status(502).json({ error: 'Something went wrong. Please try again or contact us directly.' });
  }
};
