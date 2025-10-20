const axios = require('axios')

const PAY_URL = 'https://zenoapi.com/api/payments/mobile_money_tanzania';
const STATUS_URL = 'https://zenoapi.com/api/payments/order-status';

// Create a payment with ZenoPay
// Params: { order_id, buyer_name, buyer_phone, buyer_email, amount, webhook_url, metadata }
const makePayment = async (payload) => {
    const apiKey = process.env.ZENO_API_KEY || process.env.ZENOPAY_API_KEY || "";
    try {
        const res = await axios.post(PAY_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });
        return res.data;
    } catch (error) {
        throw error;
    }
}

// Get transaction status by order_id
const getTransactionStatus = async (order_id) => {
    const apiKey = process.env.ZENO_API_KEY || process.env.ZENOPAY_API_KEY || "";
    try {
        const res = await axios.get(`${STATUS_URL}?order_id=${order_id}`, {
            headers: { 'x-api-key': apiKey }
        });
        return res.data;
    } catch (error) {
        throw error;
    }
}

module.exports = { makePayment, getTransactionStatus }