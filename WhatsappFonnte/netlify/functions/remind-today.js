const { schedule } = require('@netlify/functions');
const supabase = require('../../utils/supabase');
const { formatPhoneNumber, sendFonnteMessage } = require('../../utils/fonnte');

function getWITAToday() {
    const date = new Date();
    // UTC to WITA (UTC+8)
    date.setUTCHours(date.getUTCHours() + 8);
    return date.toISOString().split('T')[0];
}

const handler = async function(event, context) {
    console.log("Cron remind-today triggered. Note: Fonnte notifications are disabled in favor of self-hosted WhatsappGateway.");
    return { statusCode: 200 };
};

// 03:00 WITA is 19:00 UTC (previous day). Cron: 0 19 * * *
exports.handler = schedule('0 19 * * *', handler);
