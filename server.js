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

    // Step 1: Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: `Shabbat Reservation - ${meal} (${name})`,
      receipt_email: email,
      metadata: { name, email, phone }
    });

    // Step 2: Log to NocoDB with proper field names
    const record = await axios.post(process.env.NOCO_API_URL, {
      "Name": name,
      "Email": email,
      "Phone": phone,
      "Shabbat Date": date,
      "Meals": meal,
      "Adults": adults,
      "ChildernKids": kids,
      "Discount": discount,
      "Donation": donation,
      "Discounted Price": discountAmount,
      "Comments": comments,
      "Total Amount": amount,
      "StripePaymentID": paymentIntent.id,
      "PaymentStatus": "Pending" // must match case-sensitive dropdown value
    }, {
      headers: {
        'xc-token': process.env.NOCO_API_TOKEN
      }
    });

    const recordId = record.data.Id || record.data.id;

    // Step 3: Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Shabbat Reservation - ${meal}`
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        nocodb_record_id: recordId
      },
      success_url: 'https://yourdomain.org/thank-you?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://yourdomain.org/shabbat-form?canceled=1'
    });

    // Step 4: Redirect to Stripe Checkout
    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ Stripe/NocoDB Error:", err.message);
    res.status(500).json({ error: "Registration failed." });
  }
});

