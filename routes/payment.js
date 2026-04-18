const router = require('express').Router()
const axios = require("axios");
const { isValidPhoneNumber, getPhoneNumberDetails } = require('tanzanian-phone-validator');
const { makePayment } = require('../utils/zenoapi');
const User = require('../models/User');
const PaymentBin = require('../models/PaymentBin');
const { sendTelegramNotification } = require('../utils/sendTelegramNotifications');
const { confirmMonthlySubscription } = require('../utils/confirmSubscription');

// helpers
const generateOrderId = (phone) => `MTIPS${Date.now().toString(36)}`;

// plan → amount + grant key
const PRICE = {
    monthly: 8920
};

function normalizePhone(phone9 = '') {
    //if (!isValidPhoneNumber(`255${phone9.trim()}`)) return null;

    const phoneString = String(phone9).trim();

    // Ensure it starts with 6 or 7 and is followed by exactly 8 digits
    if (!/^[67]\d{8}$/.test(phoneString)) {
        return null;
    }

    return `255${phoneString}`;
}

// POST /api/pay
// Serve the HTMX payment form (to be loaded inside the modal)
router.get('/api/pay-form', async (req, res) => {
    try {
        return res.render('premium/extras/htmx-form', { layout: false });
    } catch (error) {
        res.render('zz-fragments/payment-error', { layout: false, message: 'Imeshindikana kupakia fomu ya malipo.' });
    }
});

router.post("/api/pay", async (req, res) => {
    if (!req.session || !req.session.user) {
        res.set('HX-Reswap', 'none');
        return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tafadhali ingia (login) kuendelea na malipo.' });
    }
    console.log("Received the post req:", { ...req.body, email: req.user?.email || req.session?.user?.email })
    try {
        const email = (req.user?.email || req.session?.user?.email || '').trim();
        const phone9 = String(req.body.phone9 || '').trim();

        // basic validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Barua pepe si sahihi. Tafadhali login upya.' });
        }

        if (!/^([1-9][0-9]{8})$/.test(phone9)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Weka tarakimu 9 bila kuanza na 0' });
        }

        const phone = normalizePhone(phone9);
        if (!phone) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Weka tarakimu 9 bila kuanza na 0' });
        }

        const phoneNumberDetails = getPhoneNumberDetails(phone);
        if (phoneNumberDetails?.telecomCompanyDetails?.brand?.toLowerCase() === 'vodacom') {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Samahani! Malipo kwa Vodacom hayaruhusiwi kwa sasa. Tumia Tigo, Airtel au Halotel.' });
        }

        // restrict halotel temporary
        // if (phoneNumberDetails.telecomCompanyDetails.brand.toLowerCase() === 'halotel') {
        //     res.set('HX-Reswap', 'none');
        //     return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Samahani! Kuna changamoto ya mtandao kwa Halotel. Tafadhali tumia Tigo au Airtel.' });
        // }

        const user = await User.findOne({ email })
        if (!user) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tumeshindwa pata taarifa zako. Tafadhali login upya.' });
        }

        const orderRef = generateOrderId(phone9);

        // build payment payload
        const payload = {
            orderRef,
            user: { userId: user._id, email: user.email, name: user.name || user.email.split('@')[0] },
            phoneNumber: phone,
            amount: email === "janjatzblog@gmail.com" ? 1000 : PRICE.monthly
        };

        const bkaziServer = "https://baruakazi.co.tz/payment/process/mtips"

        try {
            await axios.post(bkaziServer, payload, {
                headers: { "x-webhook-secret": process.env.PASS_USER }
            });
        } catch (error) {
            let message = 'Imeshindikana kuanzisha malipo. Jaribu tena baadaye.';

            if (error?.response) {
                // Server responded (4xx / 5xx)
                message = error.response.data?.message || message;
            } else if (error?.request) {
                // Request sent but no response
                message = 'Hakuna majibu kutoka server. Angalia internet yako au jaribu tena.';
            } else {
                // Something else
                message = error.message;
            }

            console.error('Payment initiation error:', message);

            return res.render('zz-fragments/payment-error', {
                layout: false,
                message
            });
        }

        //send initiating message
        sendTelegramNotification(`💰 ${email}, ${phone} initiated payment for monthly plan - MTips`, false)

        return res.render('zz-fragments/payment-initiated', { layout: false, orderId: orderRef, phone });
    } catch (error) {
        console.log('PAY error:', error?.message, error);
        res.set('HX-Reswap', 'none');
        return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Hitilafu imetokea. Tafadhali jaribu tena.' });
    }
});

router.post('/api/payment-webhook', async (req, res) => {
    try {
        const { order_id, payment_status, email, phone, reference } = req.body || {};

        const secret = req.headers['x-webhook-secret'];

        if (!order_id || secret !== process.env.PASS_USER) return res.status(200).json({ message: 'Invalid webhook call. No orderId or valid secret' });

        if (payment_status === 'COMPLETED') {
            try {
                // grant subscription and notify
                await confirmMonthlySubscription(email, phone)
            }
            catch (e) {
                console.log('grantSubscription webhook error:', e?.message);
                sendTelegramNotification(`❌ Failed to confirm a paid sub for ${email} on MTips. Please confirm manually`)
            }
        }
        return res.sendStatus(200);
    } catch (error) {
        console.log('WEBHOOK error:', error?.message, error);
        return res.sendStatus(200);
    }
});

module.exports = router
