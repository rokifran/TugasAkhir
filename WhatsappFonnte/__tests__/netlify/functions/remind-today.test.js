const { schedule } = require('@netlify/functions');
const supabase = require('../../../utils/supabase');
const { formatPhoneNumber, sendFonnteMessage } = require('../../../utils/fonnte');

// Mock external dependencies
jest.mock('@netlify/functions', () => ({
    schedule: jest.fn((cron, handler) => handler)
}));
jest.mock('../../../utils/supabase', () => {
    const eqMock = jest.fn();
    const secondEqMock = jest.fn().mockReturnValue({ data: [], error: null });
    eqMock.mockReturnValue({ eq: secondEqMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });
    return {
        from: fromMock,
        _eqMock: eqMock,
        _secondEqMock: secondEqMock
    };
});
jest.mock('../../../utils/fonnte', () => ({
    formatPhoneNumber: jest.fn(num => num),
    sendFonnteMessage: jest.fn()
}));

const handler = require('../../../netlify/functions/remind-today').handler;

describe('remind-today function', () => {
    beforeEach(() => {
        supabase._eqMock.mockClear();
        supabase._secondEqMock.mockClear();
        formatPhoneNumber.mockClear();
        sendFonnteMessage.mockClear();
        // Reset supabase mock implementations to default success
        supabase._secondEqMock.mockResolvedValue({ data: [], error: null });
    });

    it('should be scheduled with correct cron expression', () => {
        expect(schedule).toHaveBeenCalledWith('0 19 * * *', expect.any(Function));
    });

    it('should return "No jobs" if no jobs are found', async () => {
        const result = await handler();
        expect(result.statusCode).toBe(200);
        expect(result.body).toBe('No jobs');
        expect(sendFonnteMessage).not.toHaveBeenCalled();
    });

    it('should send reminders for found jobs', async () => {
        // Mock data
        supabase._secondEqMock.mockResolvedValue({
            data: [
                {
                    kode_lokasi: 'LOK-01',
                    teknisi: {
                        nama: 'John Doe',
                        kontak: '081234567890'
                    },
                    maintenance_detail: [
                        { kategori_perangkat: { nama_perangkat: 'Router' } },
                        { kategori_perangkat: { nama_perangkat: 'Switch' } }
                    ]
                }
            ],
            error: null
        });

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe('Reminders sent');
        
        expect(formatPhoneNumber).toHaveBeenCalledWith('081234567890');
        expect(sendFonnteMessage).toHaveBeenCalledWith(
            '081234567890',
            'Halo John Doe, jangan lupa ada maintenance hari ini di LOK-01 untuk perangkat: Router, Switch.'
        );
    });

    it('should skip jobs without technician contact', async () => {
        supabase._secondEqMock.mockResolvedValue({
            data: [
                {
                    kode_lokasi: 'LOK-02',
                    teknisi: { nama: 'Jane Doe', kontak: null },
                    maintenance_detail: []
                }
            ],
            error: null
        });
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(consoleWarnSpy).toHaveBeenCalledWith('No technician contact found for job at LOK-02');
        expect(sendFonnteMessage).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
    });

    it('should handle jobs with no devices', async () => {
        supabase._secondEqMock.mockResolvedValue({
            data: [
                {
                    kode_lokasi: 'LOK-03',
                    teknisi: { nama: 'Alice', kontak: '123' },
                    maintenance_detail: []
                }
            ],
            error: null
        });

        await handler();

        expect(sendFonnteMessage).toHaveBeenCalledWith(
            '123',
            'Halo Alice, jangan lupa ada maintenance hari ini di LOK-03 untuk perangkat: Tidak ada perangkat.'
        );
    });

    it('should return 500 if supabase query fails', async () => {
        supabase._secondEqMock.mockResolvedValue({
            data: null,
            error: new Error('DB Error')
        });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = await handler();

        expect(result.statusCode).toBe(500);
        expect(result.body).toBe('DB Error');
        
        consoleErrorSpy.mockRestore();
    });
});
