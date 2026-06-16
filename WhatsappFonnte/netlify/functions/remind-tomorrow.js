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
    console.log("Cron remind-tomorrow triggered.");
    
    try {
        const tomorrowStr = getWITATomorrow();
        console.log(`Checking maintenance for tomorrow's date: ${tomorrowStr}`);

        const { data: maintenanceJobs, error } = await supabase
            .from('maintenance')
            .select(`
                kode_lokasi,
                teknisi ( kontak ),
                client ( kontak )
            `)
            .eq('tanggal_maintenance', tomorrowStr)
            .eq('status', false);

        if (error) throw error;

        if (!maintenanceJobs || maintenanceJobs.length === 0) {
            console.log('No maintenance jobs found for tomorrow.');
            return { statusCode: 200 };
        }

        console.log(`Found ${maintenanceJobs.length} maintenance jobs for tomorrow. Sending reminders...`);

        for (const job of maintenanceJobs) {
            // Send to Technician
            const techContact = job.teknisi?.kontak;
            if (techContact) {
                const techTargetNumber = formatPhoneNumber(techContact);
                if (techTargetNumber) {
                    const techMessage = `Dont forget there is a maintenance tomorow on ${job.kode_lokasi}`;
                    await sendFonnteMessage(techTargetNumber, techMessage);
                }
            }

            // Send to Client
            const clientContact = job.client?.kontak;
            if (clientContact) {
                const clientTargetNumber = formatPhoneNumber(clientContact);
                if (clientTargetNumber) {
                    const clientMessage = `Dont forget there is a maintenance tomorow`;
                    await sendFonnteMessage(clientTargetNumber, clientMessage);
                }
            }
        }
        
        return { statusCode: 200 };
    } catch (error) {
        console.error('Error in remind-tomorrow handler:', error.message);
        return { statusCode: 500 };
    }
};

// 08:00 WITA is 00:00 UTC. Cron: 0 0 * * *
exports.handler = schedule('0 0 * * *', handler);
