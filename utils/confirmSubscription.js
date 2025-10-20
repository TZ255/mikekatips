const User = require("../models/User");
const { sendTelegramNotification } = require("./sendTelegramNotifications");

const confirmMonthlySubscription = async (email) => {
    try {
        const user = await User.findOne({ email });
        if (!user) throw new Error('User not found');

        user.isPaid = true;
        user.paidAt = new Date();
        user.expiresAt = new Date(new Date().setMonth(new Date().getMonth() + 1));

        await user.save();
        sendTelegramNotification(`✅ MikekaTips - Malipo yamethibitishwa kwa ${email} (manual confirmation)`)
        return user;
    } catch (error) {
        console.error('Error confirming subscription:', error);
        throw error;
    }
};

//unconfirme user subscription
const unconfirmUserSubscription = async (email) => {
    try {
        const user = await User.findOne({ email });
        if (!user) console.log('User not found');

        user.isPaid = false;
        user.paidAt = null;
        user.expiresAt = null;

        await user.save();
        sendTelegramNotification(`❌ MikekaTips - Subscription revoked for ${email} (manual)`)
        return user;
    } catch (error) {
        console.error('Error unconfirming subscription:', error);
        sendTelegramNotification(`⚠️ MikekaTips - Error unconfirming subscription for ${email} (manual): ${error.message}`)
    }
}

module.exports = { confirmMonthlySubscription, unconfirmUserSubscription }