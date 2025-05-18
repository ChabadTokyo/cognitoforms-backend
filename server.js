const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Stripe = require('stripe');
const app = express();

// Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Middleware
app.use(cors());
app.use(express.json());

// ---------- REGISTER ROUTE ----------
app.post('/register', async (req, res) => {
  try {
    const fields = req.body.fields;

    const name = fields.name?.value || '';
    const email = fields.email?.value || '';
    const phone = fields.phone?.value || '';
    const date = fields.date?.value || '';
    const meal = fields.meal?.value || '';
    const adults = parseInt(fields.adults?.value) || 0;
    const kids = parseInt(fields.kids?.value) || 0;
    const discount = !!fields.discount?.value;
    const discountAmount = parseFloat(fields.discount_amount?.value) || 0;
    const donation = parseFloat(fields.donation?.value) || 0;
    const comments = fields.comments?.value || '';
    const amount = parseFloat(fields.amount?.value) || 0;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Shabbat Reservation - ${meal}`
          },
        },
        quantity: 1
      }],
      metadata: {
        name,
        email,
        phone
      },
      success_url: 'https://yourdomain.org/thank-you?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://yourdomain.org/shabbat-form?canceled=1',
    });

    // Save to NocoDB
    const record = await axios.post(process.env.NOCO_API_URL, {
      "Name": name,
      "Email": email,
      "Phone": phone,
      "Shabbat Date": date,
      "Meals": meal,
      "Adults": adults,
      "Childern/Students": kids,
      "Discount": discount,
      "Discounted Price": discountAmount,
      "Donation": donation,
      "Comments": comments,
      "Total Amount": amount,
      "StripePaymentID": session.id,
      "Payment Status": "Pending"
    }, {
      headers: {
        'xc-token': process.env.NOCO_API_TOKEN
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ /register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ---------- WEBHOOK ROUTE ----------
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      await axios.patch(`${process.env.NOCO_API_URL}?where=StripePaymentID,eq,${session.id}`, {
        "PaymentStatus": "Succeeded"
      }, {
        headers: {
          'xc-token': process.env.NOCO_API_TOKEN
        }
      });

      console.log(`✅ Payment succeeded — record with session ${session.id} updated.`);
    } catch (err) {
      console.error("❌ Failed to update NocoDB record:", err.message);
    }
  }

  res.status(200).json({ received: true });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

