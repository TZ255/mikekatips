const express = require('express');
const dayjs = require('dayjs');
const Tip = require('../models/Tip');
const User = require('../models/User');
const { optionalAuth, authMiddleware } = require('../middleware/auth');
const { isValidPhoneNumber, getPhoneNumberDetails } = require('tanzanian-phone-validator');
const { initiateClickPesaUSSDPush, checkPaymentStatus, generateCheckOutLink } = require('../utils/clickPesaAPI');
const BaruakaziPaymentBinModel = require('../models/PaymentBin');

const router = express.Router();

// Payment page
router.get('/payment/index', authMiddleware, (req, res) => {
  res.render('payment');
});


// POST /payment/process - Process payment request
router.post('/payment/process', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;
        const fixedAmt = 9000

        // Validate phone number format (+255XXXXXXXXX)
        if (!phoneNumber || !/^\+255\d{9}$/.test(phoneNumber)) {
            return res.status(400).json({
                error: 'Namba ya simu si sahihi. Weka namba ya simu bila kuanza na 0'
            });
        }

        // check if phone number is available and is not voda
        const isTZPhoneNumber = isValidPhoneNumber(phoneNumber);
        if (!isTZPhoneNumber) {
            return res.status(400).json({
                error: 'Namba ya simu si sahihi. Weka namba sahihi bila kuanza na 0. Mfano: 7123456789'
            });
        }

        const phoneNumberDetails = getPhoneNumberDetails(phoneNumber);
        if (phoneNumberDetails.telecomCompanyDetails.brand.toLowerCase() === 'vodacom') {
            return res.status(400).json({
                error: 'Samahani! Malipo kwa Vodacom hayaruhusiwi kwa sasa. Tumia Tigo, Airtel au Halotel.'
            });
        }

        // Validate amount
        if (!amount || amount !== 9000) {
            return res.status(400).json({
                error: 'Kiasi cha malipo si sahihi'
            });
        }

        // Get user from session
        const user = await User.findOne({email: req.session.user.email});
        if (!user) {
            return res.status(404).json({ error: 'Mtumiaji hakupatikana' });
        }

        console.log('Payment request received:', {
            userId: user._id,
            userEmail: user.email,
            phoneNumber,
            amount
        });

        // Send payment request to mobile money API (M-Pesa, Tigo Pesa, etc.)
        const orderRef = `MTIPSORDER${Date.now()}PHONE${phoneNumber.replace('+', '')}`;

        let paymentUSSDResponse;
        try {
            paymentUSSDResponse = await initiateClickPesaUSSDPush(fixedAmt, 'TZS', orderRef, phoneNumber.replace('+', ''));
            console.log('MTips Payment USSD response:', paymentUSSDResponse);
        } catch (apiError) {
            console.error('ClickPesa API error:', apiError);
            return res.status(500).json({
                error: 'Tumeshindwa kutuma ombi la malipo. Tafadhali hakikisha namba ya simu na ujaribu tena.'
            });
        }

        // Store payment request in database with pending status
        try {
            await BaruakaziPaymentBinModel.create({
                userId: user._id,
                userEmail: user.email,
                paymentId: paymentUSSDResponse?.id || orderRef,
                orderReference: paymentUSSDResponse?.orderReference || orderRef,
                paymentStatus: paymentUSSDResponse?.status || 'PROCESSING'
            });
        } catch (dbError) {
            console.error('Database error while creating payment record:', dbError);
            return res.status(500).json({
                error: 'Tumeshindwa kuhifadhi ombi la malipo. Tafadhali jaribu tena.'
            });
        }

        res.json({
            success: true,
            message: 'Ombi la malipo limetumwa kikamilifu. Fuata maagizo kwenye simu yako kufanya malipo.',
            paymentId: paymentUSSDResponse?.orderReference || orderRef,
        });

    } catch (error) {
        console.error('Payment processing error:', error.message);
        res.status(500).json({
            error: error.message || 'Tumeshindwa anzisha malipo. Tafadhali jaribu tena baadaye.'
        });
    }
});


// POST /payment/confirm - Payment status checking endpoint
router.post('/payment/confirm', authMiddleware, async (req, res) => {
    try {
        const { orderReference } = req.body;

        if (!orderReference) {
            return res.status(400).json({
                status: 'error',
                message: 'OrderReference is required'
            });
        }

        // Check payment status in database
        const payment = await BaruakaziPaymentBinModel.findOne({ orderReference });

        if (!payment) {
            return res.status(404).json({
                status: 'error',
                message: 'Payment not found'
            });
        }

        // Map payment statuses to client-expected values
        let clientStatus = 'processing'; // default

        switch (payment.paymentStatus.toLowerCase()) {
            case 'confirmed':
                clientStatus = 'success';
                break;
            case 'failed':
                clientStatus = 'failed';
                break;
            case 'processing':
            case 'pending':
            default:
                clientStatus = 'processing';
                break;
        }

        res.json({
            status: clientStatus,
            paymentStatus: payment.paymentStatus,
            orderReference: payment.orderReference
        });

    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});


module.exports = router