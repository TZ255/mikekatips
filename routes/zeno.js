const router = require('express').Router()
const { isValidPhoneNumber } = require('tanzanian-phone-validator');
const { makePayment, getTransactionStatus } = require('../utils/zenoapi');
const User = require('../models/User');
const PaymentBin = require('../models/PaymentBin');
const { sendTelegramNotification } = require('../utils/sendTelegramNotifications');
const { confirmMonthlySubscription } = require('../utils/confirmSubscription');

// helpers
const WEBHOOK_BASE_DOMAIN = process.env.DOMAIN || ''
const webhook_url = `https://${WEBHOOK_BASE_DOMAIN}/api/zenopay-webhook`
const generateOrderId = (phone) => `ORD-${Date.now().toString(36)}-${phone}`;

// plan → amount + grant key
const PRICE = {
    monthly: 15000
};

// POST /api/pay
// Serve the HTMX payment form (to be loaded inside the modal)
router.get('/api/pay-form', async (req, res) => {
    try {
        return res.render('index/extras/htmx-form', { layout: false });
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

        const user = await User.findOne({email})
        if (!user) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Tumeshindwa pata taarifa zako. Tafadhali login upya.' });
        }

        const order_id = generateOrderId(phone9);

        // Save bin
        await PaymentBin.create({
            email,
            phone,
            orderId: order_id,
            payment_status: 'PENDING',
            meta: { gateway: 'ZenoPay', plan: "monthly", amount: PRICE.monthly },
            updatedAt: new Date()
        });

        // build payment payload
        const payload = {
            order_id,
            buyer_name: user.name || user.email.split('@')[0],
            buyer_phone: phone,
            buyer_email: email,
            amount: email === "janjatzblog@gmail.com" ? 500 : PRICE.monthly,
            webhook_url
        };

        const apiResp = await makePayment(payload);

        // Expecting success payload: { status: 'success', resultcode:'000', message:'...', order_id:'...' }
        if (!apiResp || apiResp.status !== 'success') {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', { layout: false, message: apiResp?.message || 'Imeshindikana kuanzisha malipo. Jaribu tena.' });
        }

        //send initiating message
        sendTelegramNotification(`💰 ${email} initiated payment for monthly plan via ZenoPay`, false)

        return res.render('zz-fragments/payment-initiated', { layout: false, orderId: apiResp.order_id || order_id, phone });
    } catch (error) {
        console.log('PAY error:', error?.message, error);
        res.set('HX-Reswap', 'none');
        return res.render('zz-fragments/payment-form-error', { layout: false, message: 'Hitilafu imetokea. Tafadhali jaribu tena.' });
    }
});

// POST /api/check-status
router.post('/api/check-status', async (req, res) => {
    try {
        const orderId = String(req.body.orderId || '').trim();
        if (!orderId) {
            return res.render('zz-fragments/payment-modal-pending', { layout: false, orderId: '', note: 'Hakuna orderId. Jaribu tena.' });
        }

        console.log('Checking Order status:', req.body)

        const record = await PaymentBin.findOne({ orderId });
        if (!record) {
            // Keep same modal, inform pending state
            return res.render('zz-fragments/payment-modal-pending', { layout: false, orderId, note: 'Hatukupata kumbukumbu ya malipo. Tafadhali jaribu tena' });
        }

        // Fail after 3 minutes without update (unless already completed)
        const threeMinutes = 1000 * 60 * 3;
        const lastUpdate = new Date(record.updatedAt || record.createdAt || Date.now()).getTime();
        if ((Date.now() - lastUpdate) > threeMinutes && record.payment_status !== 'COMPLETED') {
            try {
                record.payment_status = 'FAILED';
                record.updatedAt = new Date();
                await record.save();
            } 
            catch (e) { 
                console.log('Mark FAILED error:', e?.message); 
            }
            return res.render('zz-fragments/payment-modal-failed', { layout: false, orderId, email: record?.email });
        }

        if (record.payment_status === 'COMPLETED') {
            let user = await User.findOne({ email: record?.email })
            let message = `Malipo yako yamewezeshwa hadi ${new Date(user?.expiresAt).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' })}`
            return res.render('zz-fragments/payment-modal-complete', { layout: false, orderId, message });
        }

        if (record.payment_status === 'FAILED') {
            return res.render('zz-fragments/payment-modal-failed', { layout: false, orderId, email: record?.email });
        }

        // Compute remaining seconds for countdown (reuse 3-min window and lastUpdate above)
        const remainingMs = Math.max(0, (1000 * 60 * 3) - (Date.now() - lastUpdate));
        const remainingSec = Math.ceil(remainingMs / 1000);
        return res.render('zz-fragments/payment-modal-pending', { layout: false, orderId, note: `Bado tunasubiri uthibitisho wa muamala kwenye namba ${record?.phone}. Tafadhali thibitisha`, remainingSec });
    } catch (error) {
        console.log('CHECK-STATUS error:', error?.message, error);
        // keep modal; provide a conservative countdown
        return res.render('zz-fragments/payment-modal-pending', { layout: false, orderId: req.body?.orderId, note: 'Imeshindikana kuthibitisha sasa. Subiri kidogo...', remainingSec: 120 });
    }
});

// POST /api/zenopay-webhook
router.post('/api/zenopay-webhook', async (req, res) => {
    try {
        const { order_id, payment_status, buyer_phone, reference, metadata } = req.body || {};
        if (!order_id) return res.sendStatus(200);

        const record = await PaymentBin.findOne({ orderId: order_id });
        if (record) {
            if (payment_status === 'COMPLETED') {
                // Update user
                record.payment_status = payment_status || record.payment_status;
                record.reference = reference || record.reference;
                record.updatedAt = new Date();
                await record.save();

                try {
                    // grant subscription and notify
                    await confirmMonthlySubscription(record?.email)
                }
                catch (e) {
                    console.log('grantSubscription webhook error:', e?.message);
                    sendTelegramNotification(`❌ Failed to confirm a paid sub for ${record?.email} - ${record?.meta?.plan}. Please confirm manually`)
                }
            }
        }
        return res.sendStatus(200);
    } catch (error) {
        console.log('WEBHOOK error:', error?.message, error);
        return res.sendStatus(200);
    }
});

module.exports = router
