const { default: axios } = require("axios");

// receive the message and send telegram notification via axios
const chatId = 741815228

const sendTelegramNotification = async (message, disable_notification = false) => {
    try {
        const botToken = process.env.NOTIFY_BOT_TOKEN;
        if (!botToken) {
            console.log('Telegram bot token not configured.');
            return;
        }

        if(process.env.NODE_ENV === 'development') {
            console.log(`Development mode: ${message}`);
            return;
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: message,
            disable_notification,
            parse_mode: 'HTML'
        };

        await axios.post(url, payload);
    } catch (error) {
        console.error('Error sending Telegram notification:', error.message);
    }
}

module.exports = { sendTelegramNotification };