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
    console.log("Cron remind-today triggered.");
    
    try {
        const today = getWITAToday();
        console.log(`Checking maintenance for date: ${today}`);

        const { data: maintenanceJobs, error } = await supabase
            .from('maintenance')
            .select(`
                kode_lokasi,
                teknisi (
                    kontak
                )
            `)
            .eq('tanggal_maintenance', today)
            .eq('status', false);

        if (error) throw error;

        if (!maintenanceJobs || maintenanceJobs.length === 0) {
            console.log('No maintenance jobs found for today.');
            return { statusCode: 200 };
        }

        console.log(`Found ${maintenanceJobs.length} maintenance jobs. Sending reminders...`);

        for (const job of maintenanceJobs) {
            const contact = job.teknisi?.kontak;
            if (!contact) {
                console.warn(`No technician contact found for job at ${job.kode_lokasi}`);
                continue;
            }

            const targetNumber = formatPhoneNumber(contact);
            if (!targetNumber) continue;

            const message = `Dont forget there is a maintenance today on ${job.kode_lokasi}`;
            await sendFonnteMessage(targetNumber, message);
        }
        
        return { statusCode: 200 };
    } catch (error) {
        console.error('Error in remind-today handler:', error.message);
        return { statusCode: 500 };
    }
};

// 03:00 WITA is 19:00 UTC (previous day). Cron: 0 19 * * *
exports.handler = schedule('0 19 * * *', handler);
