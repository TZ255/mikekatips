const User = require("../models/User");
const sendEmail = require("./sendemail");
const { sendTelegramNotification } = require("./sendTelegramNotifications");

const confirmMonthlySubscription = async (email, phone = null) => {
    try {
        const user = await User.findOne({ email });
        if (!user) throw new Error('User not found');

        user.isPaid = true;
        user.paidAt = new Date();
        user.expiresAt = new Date(new Date().setMonth(new Date().getMonth() + 1));
        user.phone = phone;
        await user.save();
        
        const subject = 'Hongera! Malipo Yako ya Premium Tips Yamethibitishwa 🎉';

        sendEmail(
            email,
            subject,
            `
  <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 20px 24px;">
      <h1 style="color: #1a1a1a; font-size: 22px; margin-top: 0;">
        Malipo Yamepokelewa! 🎉
      </h1>

      <p style="font-size: 15px; color: #333333;">
        Mpendwa <strong>${user.name || 'mteja wa MikekaTips'}</strong>,
      </p>

      <p style="font-size: 15px; color: #333333; line-height: 1.6;">
        Malipo yako ya <strong>Premium Tips</strong> yamethibitishwa kikamilifu.
        Kuanzia leo utapata <strong>Premium Tips kila siku</strong> kwa kipindi cha
        <strong>mwezi mmoja</strong>.
      </p>

      <p style="font-size: 15px; color: #333333; line-height: 1.6; margin-bottom: 16px;">
        Kupitia <strong>MikekaTips Tanzania</strong> utapata:
      </p>

      <ul style="font-size: 15px; color: #333333; line-height: 1.6; padding-left: 18px; margin-top: 0; margin-bottom: 16px;">
        <li>Mechi zilizochambuliwa kwa umakini kila siku</li>
        <li>Tips zenye nafasi kubwa ya ushindi</li>
      </ul>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://mikekatips.co.tz/"
           style="display: inline-block; padding: 12px 24px; font-size: 15px; text-decoration: none; 
                  background-color: #16a34a; color: #ffffff; border-radius: 4px;">
          Fungua Premium Tips Sasa
        </a>
      </div>

      <p style="font-size: 14px; color: #555555; line-height: 1.6;">
        Asante kwa kuichagua <strong>MikekaTips Tanzania</strong>. Tunakutakia ushindi mwema
        na mikeka yenye faida kila siku!
      </p>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />

      <p style="font-size: 12px; color: #888888; line-height: 1.4;">
        Ukiwa na swali lolote kuhusu akaunti yako au malipo,
        tafadhali wasiliana nasi kupitia ukurasa wa mawasiliano kwenye tovuti yetu au jibu ujumbe huu.
      </p>
    </div>
  </div>
  `
        );

        sendTelegramNotification(`✅ MikekaTips - Malipo yamethibitishwa kwa ${email} (auto confirmation)`)
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