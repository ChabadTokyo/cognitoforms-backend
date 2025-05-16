// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Stripe = require('stripe');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    // Step 1: Create NocoDB record (status: Pending)
    const nocoRes = await axios.post(process.env.NOCO_API_URL, {
      "Name": name,
      "Email": email,
      "Phone Number": phone,
      "Shabbat Date": date,
      "Meals": meal,
      "Adults": adults,
      "Childern/Students": kids,
      "Discount": discount,
      "Donation": donation,
      "Discounted Price": discountAmount,
      "Comments": comments,
      "Total Amount": amount,
      "PaymentStatus": "Pending"
    }, {
      headers: { 'xc-token': process.env.NOCO_API_TOKEN }
    });

    const recordId = nocoRes.data.Id || nocoRes.data.id;

    // Step 2: Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Shabbat Reservation - ${meal} (${name})`
          },
        },
        quantity: 1
      }],
      metadata: { nocodb_record_id: recordId },
      success_url: 'https://chabadjapan.org/thank-you?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://chabadjapan.org/shabbat-form?canceled=1',
    });

    // Step 3: Return Stripe checkout URL to frontend
    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ /register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

