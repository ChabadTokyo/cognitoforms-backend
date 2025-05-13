const express = require('express');
const Stripe = require('stripe');
const axios = require('axios');
const cors = require('cors');

const app = express();
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

    // Step 1: Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: 'usd',
      description: `Shabbat reservation for ${name}`,
      receipt_email: email,
      metadata: {
        name,
        email,
        phone
      }
    });

    // Step 2: Log to NocoDB
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
      DiscountAmount: discountAmount,
      Comments: comments,
      Amount: amount,
      StripePaymentID: paymentIntent.id,
      PaymentStatus: "pending"
    }, {
      headers: {
        'xc-token': process.env.NOCO_API_TOKEN
      }
    });

    // Step 3: Return Stripe clientSecret to frontend
    res.json({ clientSecret: paymentIntent.client_secret });

  } catch (error) {
    console.error('❌ Stripe/NocoDB Error:', error.message);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

