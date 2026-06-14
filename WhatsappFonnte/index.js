require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const supabase = require('./supabase');

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

if (!FONNTE_TOKEN || FONNTE_TOKEN === 'YOUR_FONNTE_TOKEN_HERE') {
    console.error('FONNTE_TOKEN is not set in .env file! Please add your Fonnte token.');
    process.exit(1);
}

// Simple verification query
async function checkSupabase() {
    const { data, error } = await supabase.from('teknisi').select('*').limit(1);
    if (error) {
        console.error('Supabase connection error:', error.message);
    } else {
        console.log('Supabase connected successfully');
    }
}

/**
 * Normalizes phone numbers to format accepted by Fonnte (starts with 62 or 0)
 */
function formatPhoneNumber(number) {
    if (!number) return null;
    let formatted = number.toString().replace(/\D/g, ''); // Remove non-numeric
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.slice(1);
    }
    return formatted;
}

/**
 * Sends a message using Fonnte API
 */
async function sendFonnteMessage(target, message) {
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

            const targetNumber = formatPhoneNumber(contact);
            if (!targetNumber) continue;

            const message = `Dont forget there is a maintenance today on ${job.kode_lokasi}`;

            await sendFonnteMessage(targetNumber, message);
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
    } catch (error) {
        console.error('Error in sendTomorrowMaintenanceReminders:', error.message);
    }
}

async function start() {
    console.log('Fonnte Gateway is starting...');
    await checkSupabase();

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
}

start();
