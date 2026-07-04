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

const handler = require('../../../netlify/functions/remind-tomorrow').handler;

describe('remind-tomorrow function', () => {
    beforeEach(() => {
        supabase._eqMock.mockClear();
        supabase._secondEqMock.mockClear();
        formatPhoneNumber.mockClear();
        sendFonnteMessage.mockClear();
        // Reset supabase mock implementations to default success
        supabase._secondEqMock.mockResolvedValue({ data: [], error: null });
    });

    it('should be scheduled with correct cron expression', () => {
        expect(schedule).toHaveBeenCalledWith('0 0 * * *', expect.any(Function));
    });

    it('should return "No jobs" if no jobs are found', async () => {
        const result = await handler();
        expect(result.statusCode).toBe(200);
        expect(result.body).toBe('No jobs');
        expect(sendFonnteMessage).not.toHaveBeenCalled();
    });

    it('should send reminders for found jobs to tech and client', async () => {
        // Mock data
        supabase._secondEqMock.mockResolvedValue({
            data: [
                {
                    kode_lokasi: 'LOK-01',
                    teknisi: {
                        nama: 'John Doe',
                        kontak: '081234567890'
                    },
                    client: {
                        nama: 'Client A',
                        kontak: '08987654321'
                    },
                    maintenance_detail: [
                        { kategori_perangkat: { nama_perangkat: 'Router' } }
                    ]
                }
            ],
            error: null
        });

        const result = await handler();

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe('Reminders sent');
        
        expect(formatPhoneNumber).toHaveBeenCalledWith('081234567890');
        expect(formatPhoneNumber).toHaveBeenCalledWith('08987654321');
        
        expect(sendFonnteMessage).toHaveBeenCalledWith(
            '081234567890',
            'Halo John Doe, jangan lupa ada maintenance besok di LOK-01 untuk perangkat: Router.'
        );
        expect(sendFonnteMessage).toHaveBeenCalledWith(
            '08987654321',
            'Halo Client A, kami menginformasikan bahwa akan ada jadwal maintenance besok di lokasi Anda. Mohon kesediaannya.'
        );
    });

    it('should handle missing client or tech contacts gracefully', async () => {
        supabase._secondEqMock.mockResolvedValue({
            data: [
                {
                    kode_lokasi: 'LOK-02',
                    teknisi: { nama: 'No Tech Contact', kontak: null },
                    client: { nama: 'Client B', kontak: '123' },
                    maintenance_detail: []
                },
                {
                    kode_lokasi: 'LOK-03',
                    teknisi: { nama: 'Tech 2', kontak: '456' },
                    client: { nama: 'No Client Contact', kontak: null },
                    maintenance_detail: []
                }
            ],
            error: null
        });

        await handler();

        // Should only send to Client B
        expect(sendFonnteMessage).toHaveBeenCalledWith(
            '123',
            'Halo Client B, kami menginformasikan bahwa akan ada jadwal maintenance besok di lokasi Anda. Mohon kesediaannya.'
        );
        
        // Should only send to Tech 2
        expect(sendFonnteMessage).toHaveBeenCalledWith(
            '456',
            'Halo Tech 2, jangan lupa ada maintenance besok di LOK-03 untuk perangkat: Tidak ada perangkat.'
        );
        
        expect(sendFonnteMessage).toHaveBeenCalledTimes(2);
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
