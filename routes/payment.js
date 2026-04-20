const router = require('express').Router();
const User = require('../models/User');
const { sendTelegramNotification } = require('../utils/sendTelegramNotifications');
const { confirmMonthlySubscription } = require('../utils/confirmSubscription');
const {
    generateOrderId,
    getNetworkBrand,
    isValidEmail,
    normalizePhone,
    selectPaymentGateway,
} = require('../utils/payments/common');
const { initializeClickPesaPayment } = require('../utils/payments/clickpesa');
const { initializeSnippeGatewayPayment } = require('../utils/payments/snippe');

router.get('/api/pay-form', async (req, res) => {
    try {
        return res.render('premium/extras/htmx-form', { layout: false });
    } catch (error) {
        console.error('[pay-form]', error);
        return res.render('zz-fragments/payment-error', {
            layout: false,
            message: 'Imeshindikana kupakia fomu ya malipo.',
        });
    }
});

router.post('/api/pay', async (req, res) => {
    if (!req.session || !req.session.user) {
        res.set('HX-Reswap', 'none');
        return res.render('zz-fragments/payment-form-error', {
            layout: false,
            message: 'Tafadhali ingia (login) kuendelea na malipo.',
        });
    }

    console.log('PAY request body:', { ...req.body, email: req.user?.email || req.session?.user?.email });

    try {
        const email = (req.user?.email || req.session?.user?.email || '').trim();
        const phone = normalizePhone(req.body.phone9);

        if (!isValidEmail(email)) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', {
                layout: false,
                message: 'Barua pepe si sahihi. Tafadhali login upya.',
            });
        }

        if (!phone) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', {
                layout: false,
                message: 'Namba ya simu si sahihi. Weka tarakimu 9 bila kuanza na 0',
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', {
                layout: false,
                message: 'Tumeshindwa pata taarifa zako. Tafadhali login upya.',
            });
        }

        const networkBrand = getNetworkBrand(phone);
        const gateway = selectPaymentGateway(networkBrand);
        const orderRef = generateOrderId();

        try {
            if (gateway === 'snippe') {
                await initializeSnippeGatewayPayment({ user, email, phone, orderRef });
            } else {
                await initializeClickPesaPayment({ user, email, phone, orderRef });
            }
        } catch (error) {
            const gatewayLabel = gateway === 'snippe' ? 'Snippe' : 'ClickPesa';
            console.error(`PAY initiation error (${gatewayLabel}):`, error?.message || error);
            sendTelegramNotification(
                `❌ MTips Payment Initiation Error (${gatewayLabel})\nEmail: ${email}\nPhone: ${phone}\nNetwork: ${networkBrand}\nMessage: ${error?.message || error}`,
                false
            );
            res.set('HX-Reswap', 'none');
            return res.render('zz-fragments/payment-form-error', {
                layout: false,
                message: error?.userMessage || 'Imeshindikana kuanzisha malipo. Jaribu tena baadaye.',
            });
        }

        sendTelegramNotification(
            `💰 ${email}, ${phone} initiated payment for monthly plan - MTips via ${gateway} (${networkBrand})`,
            false
        );

        return res.render('zz-fragments/payment-initiated', {
            layout: false,
            orderId: orderRef,
            phone,
        });
    } catch (error) {
        console.error('PAY error:', error?.message || error);
        res.set('HX-Reswap', 'none');
        sendTelegramNotification(`❌ Payment Initiation Error (MTips). Check logs. ${error?.message || error}`, false);
        return res.render('zz-fragments/payment-form-error', {
            layout: false,
            message: 'Hitilafu imetokea. Tafadhali jaribu tena.',
        });
    }
});

router.post('/api/payment-webhook', async (req, res) => {
    console.log('CLICKPESA WEBHOOK received:', req.body);

    try {
        const { order_id, payment_status, email, phone } = req.body || {};
        const secret = req.headers['x-webhook-secret'];

        if (!order_id || secret !== process.env.PASS_USER) {
            return res.status(200).json({ message: 'Invalid webhook call. No orderId or valid secret' });
        }

        if (payment_status === 'COMPLETED') {
            try {
                await confirmMonthlySubscription(email, phone);
            } catch (error) {
                console.error('grantSubscription clickpesa webhook error:', error?.message || error);
                sendTelegramNotification(`❌ Failed to confirm a paid sub for ${email} on MTips. Please confirm manually`, false);
            }
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('CLICKPESA WEBHOOK error:', error?.message || error);
        return res.sendStatus(200);
    }
});

router.post('/webhook/snippe', async (req, res) => {
    console.log('SNIPPE WEBHOOK received:', req.body);
    res.status(200).json({ success: true, message: 'Webhook received' });

    try {
        const {
            id,
            type,
            data: {
                status,
                customer: { email, phone } = {},
                metadata: { order_id } = {},
            } = {},
        } = req.body || {};

        if (!id || !type || !status || !email || !phone || !order_id) {
            throw new Error('Missing required fields in webhook payload');
        }

        if (!String(email).includes('@tanzabyte.com')) {
            throw new Error('Ignoring webhook for wrong email');
        }

        if (type === 'payment.completed' && status === 'completed') {
            const userId = String(email).split('@tanzabyte.com')[0];
            const user = await User.findById(userId);

            if (!user) {
                throw new Error(`User not found for email: ${email}`);
            }

            const userEmail = user.email;
            const userPhone = String(phone).replace('+', '');

            try {
                await confirmMonthlySubscription(userEmail, userPhone);
            } catch (error) {
                console.error('grantSubscription snippe webhook error:', error?.message || error);
                sendTelegramNotification(`❌ Failed to confirm a paid sub for ${userEmail} on MTips. Please confirm manually`, false);
            }
        }
    } catch (error) {
        console.error('SNIPPE WEBHOOK error:', error?.message || error);
        sendTelegramNotification(`❌ MTips Snippe webhook error: ${error?.message || error}`, false);
    }
});

module.exports = router;
