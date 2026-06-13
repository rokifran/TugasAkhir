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
                    kontak
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

            const chatId = formatPhoneNumber(contact);
            const message = `Dont forget there is a maintenance today on ${job.kode_lokasi}`;

            try {
                await client.sendMessage(chatId, message);
                console.log(`Reminder sent to ${contact} for ${job.kode_lokasi}`);
            } catch (sendError) {
                console.error(`Failed to send message to ${contact}:`, sendError.message);
            }
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
                teknisi ( kontak ),
                client ( kontak )
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
            // Send to Technician
            const techContact = job.teknisi?.kontak;
            if (techContact) {
                const techChatId = formatPhoneNumber(techContact);
                const techMessage = `Dont forget there is a maintenance tomorow on ${job.kode_lokasi}`;
                try {
                    await client.sendMessage(techChatId, techMessage);
                    console.log(`Tomorrow reminder sent to technician ${techContact} for ${job.kode_lokasi}`);
                } catch (e) { console.error(`Failed tech message to ${techContact}:`, e.message); }
            }

            // Send to Client
            const clientContact = job.client?.kontak;
            if (clientContact) {
                const clientChatId = formatPhoneNumber(clientContact);
                const clientMessage = `Dont forget there is a maintenance tomorow`;
                try {
                    await client.sendMessage(clientChatId, clientMessage);
                    console.log(`Tomorrow reminder sent to client ${clientContact}`);
                } catch (e) { console.error(`Failed client message to ${clientContact}:`, e.message); }
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
