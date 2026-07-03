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
    try {
        const today = getWITAToday();
        console.log(`Checking maintenance for date: ${today}`);

        const { data: maintenanceJobs, error } = await supabase
            .from('maintenance')
            .select(`
                kode_lokasi,
                teknisi (
                    nama,
                    kontak
                ),
                maintenance_detail (
                    kategori_perangkat (
                        nama_perangkat
                    )
                )
            `)
            .eq('tanggal_maintenance', today)
            .eq('status', false);

        if (error) throw error;

        if (!maintenanceJobs || maintenanceJobs.length === 0) {
            console.log('No maintenance jobs found for today.');
            return { statusCode: 200, body: 'No jobs' };
        }

        console.log(`Found ${maintenanceJobs.length} maintenance jobs. Sending reminders...`);

        for (const job of maintenanceJobs) {
            const contact = job.teknisi?.kontak;
            if (!contact) {
                console.warn(`No technician contact found for job at ${job.kode_lokasi}`);
                continue;
            }

            const details = job.maintenance_detail || [];
            const deviceNames = details
                .map(d => d.kategori_perangkat?.nama_perangkat)
                .filter(Boolean);
            const devicesStr = deviceNames.length > 0 ? deviceNames.join(', ') : 'Tidak ada perangkat';
            const techName = job.teknisi?.nama || 'Teknisi';

            const chatId = formatPhoneNumber(contact);
            const message = `Halo ${techName}, jangan lupa ada maintenance hari ini di ${job.kode_lokasi} untuk perangkat: ${devicesStr}.`;

            await sendFonnteMessage(chatId, message);
        }
        return { statusCode: 200, body: 'Reminders sent' };
    } catch (error) {
        console.error('Error in remind-today handler:', error.message);
        return { statusCode: 500, body: error.message };
    }
};

// 03:00 WITA is 19:00 UTC (previous day). Cron: 0 19 * * *
exports.handler = schedule('0 19 * * *', handler);
