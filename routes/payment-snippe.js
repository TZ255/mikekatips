//webhook example response from snippe

/* 
{
"id": "evt_4e3a6a40250368c1bf45b28e",
"type": "payment.completed",
"api_version": "2026-01-25",
"created_at": "2026-03-04T08:41:16Z",
"data": {
"reference": "95e426ec-c2c9-4354-a4b9-d33be4de9f86",
"external_reference": "S20443561123",
"status": "completed",
"amount": {
  "value": 500,
  "currency": "TZS"
},
"settlement": {
  "gross": {
    "value": 500,
    "currency": "TZS"
  },
  "fees": {
    "value": 2,
    "currency": "TZS"
  },
  "net": {
    "value": 498,
    "currency": "TZS"
  }
},
"channel": {
  "type": "mobile_money",
  "provider": "mpesa"
},
"customer": {
  "phone": "+255754920480",
  "name": "JanjaTZ Blog JanjaTZ Blog",
  "email": "67abaeab35ae53db4f316048@tanzabyte.com"
},
"metadata": {
  "order_id": "WALEOmmbse8d3"
},
"completed_at": "2026-03-04T08:41:14.249226Z"
}
}
*/


const router = require('express').Router()
const axios = require("axios");
const { isValidPhoneNumber, getPhoneNumberDetails } = require('tanzanian-phone-validator');
const { makePayment } = require('../utils/zenoapi');
const User = require('../models/User');
const PaymentBin = require('../models/PaymentBin');
const { sendTelegramNotification } = require('../utils/sendTelegramNotifications');
const { confirmMonthlySubscription } = require('../utils/confirmSubscription');
const { initializeSnippePayment } = require('../utils/snippeAPI');


// helpers
const generateOrderId = (phone) => `MTIPS${Date.now().toString(36)}`;

// plan → amount + grant key
const PRICE = {
    monthly: 9500
};

// normalize the user name, if it contains space, first part will be firstname, the rest will be lastname. If no space, all will be firstname and lastname will be also the same as firstname
function normalizeName(name) {
    if (!name) return { firstName: 'Customer', lastName: '' };
    const parts = name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
    return { firstName, lastName };
}

router.get('/api/pay-form', async (req, res) => {
    try {
        return res.render('premium/extras/htmx-form', { layout: false });
    } catch (error) {
        res.render('zz-fragments/payment-error', { layout: false, message: 'Imeshindikana kupakia fomu ya malipo.' });
    }
});

router.post('/api/pay', async (req, res) => {
    if (!req.session || !req.session.user) {
        res.set('HX-Reswap', 'none');
        return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tafadhali ingia (login) kuendelea na malipo.' });
    }
    console.log("Received the post req:", { ...req.body, email: req.user?.email || req.session?.user?.email })

    const email = (req.user?.email || req.session?.user?.email || '').trim();
    const phone9 = String(req.body.phone9 || '').trim();

    try {
        // basic validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Barua pepe si sahihi. Tafadhali login upya.' });
        }

        if (!/^([1-9][0-9]{8})$/.test(phone9)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Weka tarakimu 9 bila kuanza na 0' });
        }

        const phone = `255${phone9}`;
        if (!isValidPhoneNumber(phone)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Weka namba sahihi bila kuanza na 0' });
        }

        const phoneNumberDetails = getPhoneNumberDetails(phone);

        const user = await User.findOne({ email })
        if (!user) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tumeshindwa pata taarifa zako. Tafadhali login upya.' });
        }

        const orderRef = generateOrderId(phone);
        const timestamp_string = Date.now().toString(36);

        // build payment payload
        const payload = {
            "payment_type": "mobile",
            "details": {
                "amount": email === "janjatzblog@gmail.com" ? 1000 : PRICE.monthly,
                "currency": "TZS"
            },
            "phone_number": phone,
            "customer": {
                "firstname": normalizeName(user?.name || null).firstName,
                "lastname": normalizeName(user?.name || null).lastName,
                "email": `${user._id}@tanzabyte.com`
            },
            "webhook_url": "https://mikekatips.co.tz/webhook/snippe",
            "metadata": {
                "order_id": orderRef
            }
        }

        try {
            //initiate payment
            const apiResp = await initializeSnippePayment(payload);
            if (!apiResp) throw new Error('PAY error: No response from payment API');

        } catch (error) {
            let error_message = error?.message || 'Payment API returned unsuccessful response'
            console.error('Error from snippe - failed payment initiation:', error_message);
            sendTelegramNotification(`❌ MTips Error for ${email}. Failed to initiate payment`, false)
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tumeshindwa anzisha malipo. Tafadhali jaribu tena baadae.' });
        }

        //send initiating message
        sendTelegramNotification(`💰 ${email} initiated payment for monthly plan - MTips`, false)

        return res.render('zz-fragments/payment-initiated', { layout: false, orderId: orderRef, phone });
    } catch (error) {
        console.log('PAY error:', error?.message, error);
        res.set('HX-Reswap', 'none');
        sendTelegramNotification(`❌ ${email} failed to initiate payment for monthly plan - MTips`, false)
        return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Hitilafu imetokea. Tafadhali jaribu tena baadae.' });
    }
});


router.post('/webhook/snippe', async (req, res) => {
    console.log('SNIPPE WEBHOOK received:', req.body);
    res.status(200).json({ success: true, message: 'Webhook received' }); // Acknowledge receipt of the webhook immediately

    try {
        const { id, type, data: { reference, status, customer: { email, phone }, metadata: { order_id } } } = req.body || {};

        if (!id || !type || !status || !email || !phone || !order_id) {
            throw new Error('Missing required fields in webhook payload');
        }

        if (!String(email || '').includes('@tanzabyte.com')) throw new Error('Ignoring webhook for wrong email');

        if (type === 'payment.completed' && status === 'completed') {
            let user_id = String(email).split('@tanzabyte.com')[0];
            let user = await User.findById(user_id);

            if (!user) throw new Error('User not found for email: ' + email);
            let user_email = user.email;
            let user_phone = String(phone).replace('+', '');
            try {
                // grant subscription and notify
                await confirmMonthlySubscription(user_email, user_phone)
            }
            catch (e) {
                console.log('grantSubscription webhook error:', e?.message);
                sendTelegramNotification(`❌ Failed to confirm a paid sub for ${email} on MTips. Please confirm manually`)
            }
        }
    } catch (error) {
        console.error('SNIPPE WEBHOOK error:', error?.message || error);
        sendTelegramNotification(`❌ MTips Webhook error: ${error?.message || error}`, false);
    }
});

module.exports = router;