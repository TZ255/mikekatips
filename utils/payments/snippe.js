const { initializeSnippePayment } = require('../snippeAPI');
const { normalizeName } = require('./common');

const PRICE = { monthly: 9500 };
const SNIPPE_WEBHOOK_URL = 'https://baruakazi.co.tz/payment/webhook/snippe/mtips';

async function initializeSnippeGatewayPayment({ user, email, phone, orderRef }) {
    const { firstName, lastName } = normalizeName(user?.name || null);
    const payload = {
        payment_type: 'mobile',
        details: {
            amount: email === 'janjatzblog@gmail.com' ? 500 : PRICE.monthly,
            currency: 'TZS',
        },
        phone_number: phone,
        customer: {
            firstname: firstName,
            lastname: lastName,
            email: `${user._id}@tanzabyte.com`,
        },
        webhook_url: SNIPPE_WEBHOOK_URL,
        metadata: {
            order_id: orderRef,
        },
    };

    const apiResp = await initializeSnippePayment(payload);
    if (!apiResp) {
        throw new Error('PAY error: No response from payment API');
    }

    return apiResp;
}

module.exports = { initializeSnippeGatewayPayment };
