const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const supabase = require('./supabase');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready!');

    // Simple verification query
    const { data, error } = await supabase.from('teknisi').select('*').limit(1);
    if (error) {
        console.error('Supabase connection error:', error.message);
    } else {
        console.log('Supabase connected successfully');
    }

    // Schedule task at 03:00 AM every day (Today's reminders)
    cron.schedule('0 3 * * *', async () => {
        console.log('Running daily maintenance reminder task at 03:00 AM...');
        await sendMaintenanceReminders();
    }, {
        scheduled: true,
        timezone: "Asia/Makassar"
    });

    // Schedule task at 08:00 AM every day (Tomorrow's reminders)
    cron.schedule('0 8 * * *', async () => {
        console.log('Running daily "tomorrow" reminder task at 08:00 AM...');
        await sendTomorrowMaintenanceReminders();
    }, {
        scheduled: true,
        timezone: "Asia/Makassar"
    });

    console.log('Maintenance reminder tasks scheduled (03:00 AM & 08:00 AM)');
});

/**
 * Normalizes phone numbers to WhatsApp format (6281234567890@c.us)
 */
function formatPhoneNumber(number) {
    if (!number) return null;
    let formatted = number.toString().replace(/\D/g, ''); // Remove non-numeric
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.slice(1);
    } else if (formatted.startsWith('62')) {
        // Already starts with 62
    } else {
        // Assume default Indonesian prefix if it's a local number without prefix
        // formatted = '62' + formatted; 
    }
    return formatted.endsWith('@c.us') ? formatted : `${formatted}@c.us`;
}

/**
 * Safely sends a message to a WhatsApp ID, verifying if it is registered
 */
async function safeSendMessage(chatId, message, contactLabel) {
    try {
        if (!client.info || !client.info.wid) {
            console.error(`WhatsApp client is not ready. Failed to send message to ${contactLabel}.`);
            return false;
        }

        // Verify if number is registered on WhatsApp
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.warn(`Phone number ${contactLabel} (${chatId}) is not registered on WhatsApp.`);
            return false;
        }

        await client.sendMessage(chatId, message);
        console.log(`Message successfully sent to ${contactLabel}`);
        return true;
    } catch (error) {
        console.error(`Error sending message to ${contactLabel} (${chatId}):`, error.message);
        return false;
    }
}

/**
 * Main logic to fetch today's maintenance and send reminders
 */
async function sendMaintenanceReminders() {
    try {
        const today = new Date().toISOString().split('T')[0];
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
            return;
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

            await safeSendMessage(chatId, message, `technician ${contact}`);
        }
    } catch (error) {
        console.error('Error in sendMaintenanceReminders:', error.message);
    }
}

/**
 * Main logic to fetch tomorrow's maintenance and send reminders to tech and clients
 */
async function sendTomorrowMaintenanceReminders() {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
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
            return;
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
                await safeSendMessage(techChatId, techMessage, `technician ${techContact}`);
            }

            // Send to Client
            const clientContact = job.client?.kontak;
            if (clientContact) {
                const clientName = job.client?.nama || 'Client';
                const clientChatId = formatPhoneNumber(clientContact);
                const clientMessage = `Halo ${clientName}, kami menginformasikan bahwa akan ada jadwal maintenance besok di lokasi Anda. Mohon kesediaannya.`;
                await safeSendMessage(clientChatId, clientMessage, `client ${clientContact}`);
            }
        }
    } catch (error) {
        console.error('Error in sendTomorrowMaintenanceReminders:', error.message);
    }
}

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
