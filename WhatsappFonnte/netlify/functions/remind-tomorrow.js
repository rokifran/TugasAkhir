const { schedule } = require('@netlify/functions');
const supabase = require('../../utils/supabase');
const { formatPhoneNumber, sendFonnteMessage } = require('../../utils/fonnte');

function getWITATomorrow() {
    const date = new Date();
    // UTC to WITA (UTC+8)
    date.setUTCHours(date.getUTCHours() + 8);
    // Add 1 day
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().split('T')[0];
}

const handler = async function(event, context) {
    console.log("Cron remind-tomorrow triggered. Note: Fonnte notifications are disabled in favor of self-hosted WhatsappGateway.");
    return { statusCode: 200 };
};

// 08:00 WITA is 00:00 UTC. Cron: 0 0 * * *
exports.handler = schedule('0 0 * * *', handler);
