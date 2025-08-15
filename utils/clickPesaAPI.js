const axios = require("axios");

// Generate bearer token for ClickPesa
const generateClickPesaToken = async () => {
    try {
        const response = await axios.post(
            'https://api.clickpesa.com/third-parties/generate-token',
            null,
            {
                headers: {
                    'client-id': process.env.CLICKPESA_CLIENT_ID,
                    'api-key': process.env.CLICKPESA_API_KEY
                }
            }
        );

        const { success, token } = response.data;

        if (!success || !token) {
            console.error('Unexpected token response:', response.data);
            throw new Error('Invalid token response: Try again later.');
        }

        return token;
    } catch (error) {
        const serverMessage = error.response?.data?.message;
        const fallbackMessage = 'Tumeshindwa kupata token. Tafadhali jaribu tena baadaye.';
        const finalMessage = serverMessage || error.message || fallbackMessage;

        console.error('Token Generation Error:', finalMessage);
        throw new Error(finalMessage);
    }
};

// Initiate USSD Push Payment
const initiateClickPesaUSSDPush = async (amount, currency, orderReference, phoneNumber) => {
    try {
        const bearerToken = await generateClickPesaToken();

        const response = await axios.post(
            'https://api.clickpesa.com/third-parties/payments/initiate-ussd-push-request',
            {
                amount,
                currency,
                orderReference,
                phoneNumber
            },
            {
                headers: {
                    Authorization: bearerToken,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        const serverMessage = error.response?.data?.message;
        const fallbackMessage = 'Tumeshindwa anzisha malipo yako. Tafadhali jaribu tena baadaye.';
        const finalMessage = serverMessage || error.message || fallbackMessage;

        console.error('USSD Push Error:', error?.response?.data);
        throw new Error(finalMessage);
    }
};


// checkPayment status
const checkPaymentStatus = async (orderReference) => {
    try {
        const bearerToken = await generateClickPesaToken();
        const response = await axios.get(
            `https://api.clickpesa.com/third-parties/payments/${orderReference}`,
            {
                headers: {
                    Authorization: bearerToken,
                }
            }
        );

        return response.data;
    } catch (error) {
        const serverMessage = error.response?.data?.message;
        const fallbackMessage = 'Tumeshindwa thibitisha malipo yako. Tafadhali jaribu tena baadaye.';
        const finalMessage = serverMessage || error.message || fallbackMessage;

        console.error('Confirmation Error:', finalMessage);
        throw new Error(finalMessage);
    }
};


// Generate HOSTED HOSTED bearer token for ClickPesa
const generateHostedClickPesaToken = async () => {
    try {
        const response = await axios.post(
            'https://api.clickpesa.com/third-parties/generate-token',
            null,
            {
                headers: {
                    'client-id': process.env.CLICKPESA_HOSTED_CLIENT_ID,
                    'api-key': process.env.CLICKPESA_HOSTED_API_KEY
                }
            }
        );

        const { success, token } = response.data;

        if (!success || !token) {
            console.error('Unexpected token response:', response.data);
            throw new Error('Invalid token response: Try again later.');
        }

        return token;
    } catch (error) {
        const serverMessage = error.response?.data?.message;
        const fallbackMessage = 'Tumeshindwa kupata token. Tafadhali jaribu tena baadaye.';
        const finalMessage = serverMessage || error.message || fallbackMessage;

        console.error('Token Generation Error:', finalMessage);
        throw new Error(finalMessage);
    }
};


//generate checkout link
const generateCheckOutLink = async (customerPhone, customerEmail, customerName, orderReference, totalPrice) => {
    const url = 'https://api.clickpesa.com/third-parties/checkout-link/generate-checkout-url';

    const payload = {
        totalPrice, orderReference, orderCurrency: "TZS", customerName, customerEmail, customerPhone
    };

    try {
        const bearerToken = await generateHostedClickPesaToken();
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: bearerToken,
                'Content-Type': 'application/json'
            }
        });

        console.log(response.data);
        // example of data
        // { checkoutLink: 'https://checkout.clickpesa.com/CHE3829C81' }

        //example of redirect
        // /payment/checkout/confirmed?orderReference=ORDER1753487779604&status=SUCCESS"
        return response.data?.checkoutLink || '/no-link'
    } catch (error) {
        const message = error.response?.data?.message || error.message;
        console.error('Checkout URL Error:', message);
        throw new Error(message)
    }
}

module.exports = {
    initiateClickPesaUSSDPush,
    checkPaymentStatus,
    generateCheckOutLink
};
