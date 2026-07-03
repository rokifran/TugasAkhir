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
    try {
        const tomorrowStr = getWITATomorrow();
        console.log(`Checking maintenance for tomorrow's date: ${tomorrowStr}`);

        const { data: maintenanceJobs, error } = await supabase
            .from('maintenance')
            .select(`
                kode_lokasi,
                teknisi ( 
                    nama,
                    kontak 
                ),
                client ( 
                    nama,
                    kontak 
                ),
                maintenance_detail (
                    kategori_perangkat ( nama_perangkat )
                )
            `)
            .eq('tanggal_maintenance', tomorrowStr)
            .eq('status', false);

        if (error) throw error;

        if (!maintenanceJobs || maintenanceJobs.length === 0) {
            console.log('No maintenance jobs found for tomorrow.');
            return { statusCode: 200, body: 'No jobs' };
        }

        console.log(`Found ${maintenanceJobs.length} maintenance jobs for tomorrow. Sending reminders...`);

        for (const job of maintenanceJobs) {
            // Extract and format the list of devices
            const details = job.maintenance_detail || [];
            const deviceNames = details
                .map(d => d.kategori_perangkat?.nama_perangkat)
                .filter(Boolean);
            const devicesStr = deviceNames.length > 0 ? deviceNames.join(', ') : 'Tidak ada perangkat';

            // Send to Technician
            const techContact = job.teknisi?.kontak;
            if (techContact) {
                const techName = job.teknisi?.nama || 'Teknisi';
                const techChatId = formatPhoneNumber(techContact);
                const techMessage = `Halo ${techName}, jangan lupa ada maintenance besok di ${job.kode_lokasi} untuk perangkat: ${devicesStr}.`;
                await sendFonnteMessage(techChatId, techMessage);
            }

            // Send to Client
            const clientContact = job.client?.kontak;
            if (clientContact) {
                const clientName = job.client?.nama || 'Client';
                const clientChatId = formatPhoneNumber(clientContact);
                const clientMessage = `Halo ${clientName}, kami menginformasikan bahwa akan ada jadwal maintenance besok di lokasi Anda. Mohon kesediaannya.`;
                await sendFonnteMessage(clientChatId, clientMessage);
            }
        }
        return { statusCode: 200, body: 'Reminders sent' };
    } catch (error) {
        console.error('Error in remind-tomorrow handler:', error.message);
        return { statusCode: 500, body: error.message };
    }
};

// 08:00 WITA is 00:00 UTC. Cron: 0 0 * * *
exports.handler = schedule('0 0 * * *', handler);
