const { default: axios } = require("axios");

const sendNEXTSMS = async (to, message) => {
    try {
        const NEXTSMS_API_KEY = process.env.NEXTSMS_API_KEY || null

        if (!NEXTSMS_API_KEY) return console.log(`Error sending NEXTSMS: API KEY is null`);

        const data = JSON.stringify({
            "from": "MKEKALEO",
            "to": to,
            "text": message,
            "flash": 0,
            "reference": Date.now()
        });

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://messaging-service.co.tz/api/sms/v2/text/single',
            headers: {
                'Authorization': `Bearer ${NEXTSMS_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data: data
        };

        const res = await axios(config)
        console.log(`NEXTSMS sent to ${to} successfully:`, res?.data)
    } catch (error) {
        console.log(`Error sending NEXTSMS:`, error?.message)
        sendLauraNotification(GLOBAL_VARS.laura_logs_channel, `Error sending NEXTSMS to ${to}: ${error.response?.data || error.message}`, false);
    }
}

module.exports = { sendNEXTSMS }