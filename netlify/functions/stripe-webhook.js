const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Event ignored' };
  }

  const session = stripeEvent.data.object;
  const email = session.customer_details?.email || session.customer_email;
  const fname = session.customer_details?.name?.split(' ')[0] || '';

  if (!email) {
    console.error('No email found in session');
    return { statusCode: 200, body: 'No email' };
  }

  const BREVO_KEY = process.env.BREVO_API_KEY;

  // Ajoute à la liste Brevo #16
  try {
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        email,
        listIds: [16],
        attributes: { FNAME: fname, SOURCE: 'stripe-booty-sculpt' },
        updateEnabled: true
      })
    });
  } catch (err) {
    console.error('Brevo contact error:', err.message);
  }

  // Envoie l'email de livraison (template ID 46)
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        to: [{ email, name: fname }],
        templateId: 46
      })
    });
    const data = await res.json();
    console.log('Brevo email sent:', data);
  } catch (err) {
    console.error('Brevo email error:', err.message);
  }

  return { statusCode: 200, body: 'OK' };
};
