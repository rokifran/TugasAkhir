const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const supabase = require('./supabase');

const client = new Client({
    authStrategy: new LocalAuth()
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
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
