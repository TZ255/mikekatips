const axios = require('axios');

const PRICE = { monthly: 8920 };
const CLICKPESA_URL = 'https://baruakazi.co.tz/payment/process/mtips';

async function initializeClickPesaPayment({ user, email, phone, orderRef }) {
    const payload = {
        orderRef,
        user: {
            userId: user._id,
            email: user.email,
            name: user.name || user.email.split('@')[0],
        },
        phoneNumber: phone,
        amount: email === 'janjatzblog@gmail.com' ? 1000 : PRICE.monthly,
    };

    try {
        await axios.post(CLICKPESA_URL, payload, {
            headers: { 'x-webhook-secret': process.env.PASS_USER },
        });
    } catch (error) {
        let message = 'Imeshindikana kuanzisha malipo. Jaribu tena baadaye.';

        if (error?.response) {
            message = error.response.data?.message || message;
        } else if (error?.request) {
            message = 'Hakuna majibu kutoka server. Angalia internet yako au jaribu tena.';
        } else {
            message = error.message;
        }

        const initiationError = new Error(message);
        initiationError.userMessage = message;
        throw initiationError;
    }
}

module.exports = { initializeClickPesaPayment };
