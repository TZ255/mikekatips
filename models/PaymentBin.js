const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
        required: true,
    },
    paymentId: {
        type: String,
        required: true,
    },
    orderReference: {
        type: String,
        required: true,
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ["PROCESSING", "PENDING", "SUCCESS", "FAILED", "CONFIRMED"]
    }
},
    {timestamps: true}
);

//use baruakazi payment bin
const BaruakaziPaymentBinModel = mongoose.connection.useDb('baruakazi').model('PaymentBin', paymentSchema);
module.exports = BaruakaziPaymentBinModel