const axios = require('axios')

const PAY_URL = 'https://api.snippe.sh/v1/payments';

// Create a payment with SNIPPE
// Params: { order_id, buyer_name, buyer_phone, buyer_email, amount, webhook_url, metadata }
const initializeSnippePayment = async (payload) => {
    const apiKey = process.env.SNIPPE_API_KEY || ""
    const TIMEOUT = 60000;

    try {
        const res = await axios.post(PAY_URL, payload, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Idempotency-Key": payload.metadata.order_id,
                'Content-Type': 'application/json',
            },
            timeout: TIMEOUT
        });
        console.log('Payment req sent:', res.data)

        if (res.data?.status !== 'success') {
            throw new Error(`Payment API returned unsuccessful status: ${res.data?.status || 'unknown'}`);
        }
        return res.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('Payment request timed out. Please try again.');
        }
        let error_message = error?.response?.data?.message || error?.message || 'Payment API returned unsuccessful response';
        throw new Error(error_message);
    }
};

module.exports = { initializeSnippePayment }