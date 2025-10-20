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

module.exports = { confirmMonthlySubscription };