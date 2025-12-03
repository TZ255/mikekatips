const { Resend } = require("resend");
const axios = require('axios');
const FormData = require('form-data');


//VERIFYING EMAIL BEFORE SENDING
const verifyEmail = async (email) => {
    try {
        let response = await axios.post('https://verify.maileroo.net/check', {
            api_key: process.env.MAILEROO_VERIFY_KEY,
            email_address: email
        })
        return response?.data
    } catch (error) {
        console.log(error?.message)
        return { success: false, message: 'Error kwenye kuverify' }
    }
}

//SEND USING RESEND
const sendWithResend = async (recipient, subject, html) => {
    // Initialize Resend
    const resend = new Resend(process.env.RESEND_KEY);
    try {
        const data = await resend.emails.send({
            from: 'MIKEKA VIP <info@updates.mkekawaleo.com>',
            to: [recipient],
            replyTo: 'info.mkekawaleo@gmail.com',
            subject,
            html
        });
        return data;
    } catch (error) {
        console.error('Error sending email:', error);
    }
}


// SEND USING MAILEROO
const sendMailErooMails = async (recipient, subject, html) => {
    try {
        const url = 'https://smtp.maileroo.com/send';

        let data = new FormData();

        data.append('from', 'MikekaTips <info@info.mikekatips.co.tz>');
        data.append('to', `<${recipient}>`);
        data.append('reply_to', '<mikekatips.co.tz@gmail.com>')
        data.append('subject', subject);
        data.append('html', html);

        const config = {
            method: 'post',
            url: url,
            headers: {
                'X-API-Key': process.env.MAILEROO_KEY1,
                ...data.getHeaders()
            },
            data: data
        };

        axios(config)
            .then(function (response) {
                console.log(JSON.stringify(response.data));
            })
            .catch(function (error) {
                console.log(error?.message, error);
            });
    } catch (error) {
        console.log(error?.message, error)
    }
}

//SENDING EMAIL BY ROTATING MAILEROO AND RESEND
const sendEmail = async (email, subject, html) => {
    try {
        //verify email
        let checkEmail = await verifyEmail(email)
        if (checkEmail?.success === true && checkEmail.data?.mx_found === true && checkEmail.data.format_valid === true) {
            console.log(`✅ Email is correct: ${checkEmail.data.email}`)
            sendMailErooMails(email, subject, html)
        } else {
            console.log(`❌ ${checkEmail.data.email}.... We didnt bother to mail`)
        }
    } catch (error) {
        console.log('Error sending email ' + error?.message)
    }
}


module.exports = sendEmail;