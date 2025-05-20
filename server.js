// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Stripe = require('stripe');
const app = express();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Middleware setup
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors());

// ---------- REGISTER ROUTE ----------
app.post('/register', async (req, res) => {
  try {
    const fields = req.body.fields;
    if (!fields) {
      console.error("❌ Missing fields in request body");
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log("✅ Parsed fields:", fields);

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

    if (!name || !email || !date || amount <= 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create NocoDB record
    const payload = {
      "Name": name,
      "Email": email,
      "Phone Number": phone,
      "Shabbat Date": date,
      "Meals": meal,
      "Adults": adults,
      "Children": kids,
      "Discount": discount,
      "Discounted Price": discountAmount,
      "Donation": donation,
      "Comments": comments,
      "Total Amount": amount,
      "StripePaymentID": "test",
      "Payment Status": "Pending"
    };

    let record;
    try {
      record = await axios.post(process.env.NOCO_API_URL, payload, {
        headers: {
          'xc-token': process.env.NOCO_API_TOKEN,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      console.error("❌ NocoDB POST failed:", e.response?.status, e.response?.data);
      return res.status(500).json({ error: "NocoDB create failed", details: e.response?.data });
    }

    const recordId = record.data.Id || record.data.id;
    console.log("📝 NocoDB record ID:", recordId);

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: data.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Shabbat Reservation - ${meal}`,
            description: `Reservation for ${data.name}`
          },
        },
        quantity: 1
      }],
      metadata: {
        nocodb_record_id: recordId,
        name: data.name,
        email: data.email,
        phone: data.phone
      },
      success_url: 'https://chabadjapan.org/shabbat',
      cancel_url: 'https://chabadjapan.org/fkld',
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error("❌ /register error:", err.message);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// ---------- WEBHOOK ROUTE ----------
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log("✅ Stripe checkout.session completed:", session.id);

    const recordId = session.metadata?.nocodb_record_id;
    if (!recordId) {
      console.warn("⚠️ No recordId in session metadata");
      return res.status(400).send("Missing record ID");
    }

    try {
      await axios.patch(process.env.NOCO_API_URL, [
        {
          "Id": recordId,
          "Payment Status": "Succeeded",
          "StripePaymentID": session.id
        }
      ], {
        headers: {
          'xc-token': process.env.NOCO_API_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ NocoDB updated for record ${recordId}`);
    } catch (err) {
      console.error("❌ Failed to update NocoDB:", err.response?.data || err.message);
    }
  }

  res.status(200).json({ received: true });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

