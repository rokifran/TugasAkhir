require('dotenv').config();
const axios = require('axios');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

function formatPhoneNumber(number) {
    if (!number) return null;
    let formatted = number.toString().replace(/\D/g, ''); // Remove non-numeric
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.slice(1);
    }
    return formatted;
}

async function sendFonnteMessage(target, message) {
    if (!FONNTE_TOKEN || FONNTE_TOKEN === 'YOUR_FONNTE_TOKEN_HERE') {
        console.error('FONNTE_TOKEN is not set!');
        return;
    }

    try {
        const response = await axios.post('https://api.fonnte.com/send', {
            target: target,
            message: message
        }, {
            headers: {
                'Authorization': FONNTE_TOKEN
            }
        });

        if (response.data && response.data.status) {
            console.log(`Message successfully sent to ${target}`);
        } else {
            console.warn(`Failed to send message to ${target}:`, response.data.reason || 'Unknown error');
        }
    } catch (error) {
        console.error(`Error sending message to ${target} via Fonnte:`, error.message);
    }
}

module.exports = {
    formatPhoneNumber,
    sendFonnteMessage
};
