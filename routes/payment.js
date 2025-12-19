const router = require('express').Router()
const axios = require("axios");
const { isValidPhoneNumber, getPhoneNumberDetails } = require('tanzanian-phone-validator');
const { makePayment } = require('../utils/zenoapi');
const User = require('../models/User');
const PaymentBin = require('../models/PaymentBin');
const { sendTelegramNotification } = require('../utils/sendTelegramNotifications');
const { confirmMonthlySubscription } = require('../utils/confirmSubscription');

// helpers
const generateOrderId = (phone) => `MTIPS${Date.now().toString(36)}${phone}`;

// plan → amount + grant key
const PRICE = {
    monthly: 9000
};

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

        const phone = `255${phone9}`;
        if (!isValidPhoneNumber(phone)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Weka namba sahihi bila kuanza na 0' });
        }

        const phoneNumberDetails = getPhoneNumberDetails(phone);
        if (phoneNumberDetails.telecomCompanyDetails.brand.toLowerCase() === 'vodacom') {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Samahani! Malipo kwa Vodacom hayaruhusiwi kwa sasa. Tumia Tigo, Airtel au Halotel.' });
        }

        const user = await User.findOne({ email })
        if (!user) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tumeshindwa pata taarifa zako. Tafadhali login upya.' });
        }

        const orderRef = generateOrderId(phone9);

        // build payment payload
        const payload = {
            SECRET: process.env.PASS_USER,
            orderRef,
            user: { userId: user._id, email: user.email, name: user.name || user.email.split('@')[0] },
            phoneNumber: phone,
            amount: email === "janjatzblog@gmail.com" ? 500 : PRICE.monthly
        };

        const bkaziServer = "https://baruakazi-production.up.railway.app/payment/process/mtips"
        const apiResp = await axios.post(bkaziServer, payload)

        // Expecting success payload: { status: 'success', resultcode:'000', message:'...', order_id:'...' }
        if (!apiResp) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: apiResp?.message || 'Imeshindikana kuanzisha malipo. Jaribu tena.' });
        }

        if (apiResp && apiResp.data?.success !== true) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: apiResp.data?.message || 'Imeshindikana kuanzisha malipo. Jaribu tena baadaye.' });
        }

        //send initiating message
        sendTelegramNotification(`💰 ${email} initiated payment for monthly plan - MTips`, false)

        return res.render('zz-fragments/payment-initiated', { layout: false, orderId: orderRef, phone });
    } catch (error) {
        console.log('PAY error:', error?.message, error);
        res.set('HX-Reswap', 'none');
        return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Hitilafu imetokea. Tafadhali jaribu tena.' });
    }
});

// POST /api/zenopay-webhook
router.post('/api/payment-webhook', async (req, res) => {
    try {
        const { order_id, payment_status, email, phone, reference, SECRET } = req.body || {};
        if (!order_id || SECRET !== process.env.PASS_USER) return res.sendStatus(200);

        if (payment_status === 'COMPLETED') {
            try {
                // grant subscription and notify
                await confirmMonthlySubscription(email)
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
