const express = require('express');
const Stripe = require('stripe');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
app.post('/register', async (req, res) => {
  console.log("📦 Received Form Data:", req.body);
  res.json({ message: "Data received. Check console." });
});
/*
// Stripe + NocoDB Integration
app.post('/register', async (req, res) => {
  try {
    const {
      name, email, phone, date, meal,
      adults, kids, discount, donation,
      discount_amount, comments, amount
    } = req.body;

    // Step 1: Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // amount in cents
      currency: 'usd',
      description: `Shabbat registration for ${name}`,
      receipt_email: email,
      metadata: { name, email, phone }
    });

    // Step 2: Save to NocoDB with status: pending
    await axios.post(process.env.NOCO_API_URL, {
      Name: name,
      Email: email,
      Phone: phone,
      ReservationDate: date,
      Meal: meal,
      Adults: adults,
      Kids: kids,
      Discount: discount,
      Donation: donation,
      DiscountAmount: discount_amount,
      Comments: comments,
      Amount: amount,
      StripePaymentID: paymentIntent.id,
      PaymentStatus: "pending"
    }, {
      headers: {
        'xc-token': process.env.NOCO_API_TOKEN
      }
    });

    // Return client secret to frontend
    res.json({ clientSecret: paymentIntent.client_secret });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Failed to register and create payment.' });
  }
});
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

