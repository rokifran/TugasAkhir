jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('axios');

const axios = require('axios');

describe('fonnte utils', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        process.env.FONNTE_TOKEN = 'test_token';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('formatPhoneNumber', () => {
        it('should return null if number is not provided', () => {
            const { formatPhoneNumber } = require('../../utils/fonnte');
            expect(formatPhoneNumber(null)).toBeNull();
            expect(formatPhoneNumber(undefined)).toBeNull();
        });

        it('should remove non-numeric characters', () => {
            const { formatPhoneNumber } = require('../../utils/fonnte');
            expect(formatPhoneNumber('62812-3456-7890')).toBe('6281234567890');
        });

        it('should change starting 0 to 62', () => {
            const { formatPhoneNumber } = require('../../utils/fonnte');
            expect(formatPhoneNumber('081234567890')).toBe('6281234567890');
        });

        it('should not change starting 62', () => {
            const { formatPhoneNumber } = require('../../utils/fonnte');
            expect(formatPhoneNumber('6281234567890')).toBe('6281234567890');
        });
    });

    describe('sendFonnteMessage', () => {
        it('should not send if FONNTE_TOKEN is not set or default', async () => {
            process.env.FONNTE_TOKEN = 'YOUR_FONNTE_TOKEN_HERE';
            const { sendFonnteMessage } = require('../../utils/fonnte');
            const axios = require('axios');
            
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            await sendFonnteMessage('62812', 'test');
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('FONNTE_TOKEN is not set!');
            expect(axios.post).not.toHaveBeenCalled();
            
            consoleErrorSpy.mockRestore();
        });

        it('should call axios.post with correct parameters', async () => {
            const { sendFonnteMessage } = require('../../utils/fonnte');
            const axios = require('axios');
            axios.post.mockResolvedValue({ data: { status: true } });
            
            await sendFonnteMessage('6281234567890', 'Hello from test');
            
            expect(axios.post).toHaveBeenCalledWith('https://api.fonnte.com/send', {
                target: '6281234567890',
                message: 'Hello from test'
            }, {
                headers: {
                    'Authorization': 'test_token'
                }
            });
        });

        it('should log warning if response status is false', async () => {
            const { sendFonnteMessage } = require('../../utils/fonnte');
            const axios = require('axios');
            axios.post.mockResolvedValue({ data: { status: false, reason: 'Invalid target' } });
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            await sendFonnteMessage('123', 'test');
            
            expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to send message to 123:', 'Invalid target');
            
            consoleWarnSpy.mockRestore();
        });

        it('should log error if axios request fails', async () => {
            const { sendFonnteMessage } = require('../../utils/fonnte');
            const axios = require('axios');
            axios.post.mockRejectedValue(new Error('Network error'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            await sendFonnteMessage('123', 'test');
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending message to 123 via Fonnte:', 'Network error');
            
            consoleErrorSpy.mockRestore();
        });
    });
});
