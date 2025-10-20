const mongoose = require('mongoose');

const paymentBinSchema = new mongoose.Schema({
    email: { type: String, index: true },
    phone: String,
    orderId: { type: String, unique: true, index: true },
    reference: String,
    payment_status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    },
    meta: Object,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
}, { collection: 'PaymentBin' });

// Auto-clean old pending records after 24h
paymentBinSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model('PaymentBin', paymentBinSchema);