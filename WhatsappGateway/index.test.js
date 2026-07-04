jest.mock('whatsapp-web.js', () => ({
  Client: jest.fn(),
  LocalAuth: jest.fn()
}));

jest.mock('./supabase', () => ({
  from: jest.fn()
}));

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  scheduled: true
}));

const { Client, LocalAuth } = require('whatsapp-web.js');
const mockSupabase = require('./supabase');
const qrcode = require('qrcode-terminal');
const mockCron = require('node-cron');

// ---------------------------------------------------------------------------
// Single shared mock client - loaded ONCE, cleared selectively between tests
// ---------------------------------------------------------------------------
const mockClient = {
  info: { wid: 'test-wid' },
  isRegisteredUser: jest.fn(),
  sendMessage: jest.fn(),
  initialize: jest.fn(),
  on: jest.fn()
};

Client.mockImplementation(() => mockClient);
const gateway = require('./index');

const originalToISOString = Date.prototype.toISOString;

const buildSupabaseChain = (data, error) => {
  const eq1 = jest.fn();
  const eq2 = jest.fn();
  const limitFn = jest.fn();
  let resolved = false;
  const promise = {
    then: (resolve) => { if (!resolved) { resolved = true; resolve({ data, error }); } return promise; },
    catch: (fn) => { if (error && !resolved) { resolved = true; fn(error); } return promise; },
    finally: () => promise
  };
  const selectResult = { eq: eq1, limit: limitFn };
  selectResult.eq.mockReturnValue({ eq: eq2 });
  eq2.mockReturnValue(promise);
  limitFn.mockReturnValue(promise);
  const select = jest.fn().mockReturnValue(selectResult);
  const from = jest.fn(() => ({ select }));
  return { from, select, eq1, eq2, limitFn, promise };
};

beforeEach(() => {
  // Only clear mutable mock state, NOT the init-time calls (Client, on, initialize)
  mockClient.info = { wid: 'test-wid' };
  mockClient.isRegisteredUser.mockClear();
  mockClient.sendMessage.mockClear();
  mockSupabase.from.mockClear();
  mockCron.schedule.mockClear();
  qrcode.generate.mockClear();
});

afterEach(() => {
  Date.prototype.toISOString = originalToISOString;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('formatPhoneNumber', () => {
  test.each([
    [null, null],
    [undefined, null],
    ['', null],
    ['081234567890', '6281234567890@c.us'],
    ['6281234567890', '6281234567890@c.us'],
    ['81234567890', '81234567890@c.us'],
    ['6281234567890@c.us', '6281234567890@c.us'],
    ['(+62) 812-3456-7890', '6281234567890@c.us'],
    [81234567890, '81234567890@c.us'],
  ])('formatPhoneNumber(%p) → %p', (input, expected) => {
    expect(gateway.formatPhoneNumber(input)).toBe(expected);
  });
});

describe('safeSendMessage', () => {
  test('returns false when client has no info', async () => {
    mockClient.info = undefined;
    const result = await gateway.safeSendMessage('6281234567890@c.us', 'Hello', 'Test');
    expect(result).toBe(false);
  });

  test('returns false when client.info.wid is missing', async () => {
    mockClient.info = {};
    const result = await gateway.safeSendMessage('6281234567890@c.us', 'Hello', 'Test');
    expect(result).toBe(false);
  });

  test('returns false when number is unregistered', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(false);
    const result = await gateway.safeSendMessage('6281234567890@c.us', 'Hello', 'Test');
    expect(result).toBe(false);
  });

  test('sends message when number is registered', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    mockClient.sendMessage.mockResolvedValue({ id: 'msg123' });
    const result = await gateway.safeSendMessage('6281234567890@c.us', 'Hello', 'Test');
    expect(result).toBe(true);
    expect(mockClient.sendMessage).toHaveBeenCalledWith('6281234567890@c.us', 'Hello');
  });

  test('returns false on sendMessage failure', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    mockClient.sendMessage.mockRejectedValue(new Error('fail'));
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = await gateway.safeSendMessage('6281234567890@c.us', 'Hello', 'Test');
    expect(result).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('sendMaintenanceReminders', () => {
  beforeEach(() => {
    Date.prototype.toISOString = jest.fn(() => '2026-07-04T00:00:00.000Z');
  });

  test('returns early when no jobs found', async () => {
    const { from } = buildSupabaseChain([], null);
    mockSupabase.from.mockImplementation(from);
    const spy = jest.spyOn(console, 'log').mockImplementation();
    await gateway.sendMaintenanceReminders();
    expect(spy).toHaveBeenCalledWith('No maintenance jobs found for today.');
    spy.mockRestore();
  });

  test('logs error on supabase failure', async () => {
    const { from } = buildSupabaseChain(null, { message: 'DB down' });
    mockSupabase.from.mockImplementation(from);
    const spy = jest.spyOn(console, 'error').mockImplementation();
    await gateway.sendMaintenanceReminders();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Error in sendMaintenanceReminders'),
      'DB down'
    );
    spy.mockRestore();
  });

  test('sends reminder to technician', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      {
        kode_lokasi: 'LOC001',
        teknisi: { nama: 'Budi', kontak: '081234567890' },
        maintenance_detail: [
          { kategori_perangkat: { nama_perangkat: 'Router' } },
          { kategori_perangkat: { nama_perangkat: 'Switch' } }
        ]
      }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6281234567890@c.us', expect.stringContaining('Router, Switch'));
  });

  test('skips when contact missing', async () => {
    const { from } = buildSupabaseChain([
      { kode_lokasi: 'LOC002', teknisi: { nama: 'Siti', kontak: null }, maintenance_detail: [] }
    ], null);
    mockSupabase.from.mockImplementation(from);
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    await gateway.sendMaintenanceReminders();
    expect(spy).toHaveBeenCalledWith('No technician contact found for job at LOC002');
    spy.mockRestore();
  });

  test('shows "Tidak ada perangkat" for empty detail', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      { kode_lokasi: 'LOC003', teknisi: { nama: 'Andi', kontak: '081234567890' }, maintenance_detail: [] }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6281234567890@c.us', expect.stringContaining('Tidak ada perangkat'));
  });

  test('uses "Teknisi" fallback', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      { kode_lokasi: 'LOC004', teknisi: { kontak: '081234567890' }, maintenance_detail: [] }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6281234567890@c.us', expect.stringContaining('Halo Teknisi'));
  });
});

describe('sendTomorrowMaintenanceReminders', () => {
  beforeEach(() => {
    Date.prototype.toISOString = jest.fn(() => '2026-07-04T10:00:00.000Z');
  });

  test('returns early when no jobs', async () => {
    const { from } = buildSupabaseChain([], null);
    mockSupabase.from.mockImplementation(from);
    const spy = jest.spyOn(console, 'log').mockImplementation();
    await gateway.sendTomorrowMaintenanceReminders();
    expect(spy).toHaveBeenCalledWith('No maintenance jobs found for tomorrow.');
    spy.mockRestore();
  });

  test('logs error on supabase failure', async () => {
    const { from } = buildSupabaseChain(null, { message: 'DB down' });
    mockSupabase.from.mockImplementation(from);
    const spy = jest.spyOn(console, 'error').mockImplementation();
    await gateway.sendTomorrowMaintenanceReminders();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Error in sendTomorrowMaintenanceReminders'),
      'DB down'
    );
    spy.mockRestore();
  });

  test('sends to both tech and client', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      {
        kode_lokasi: 'LOC001',
        teknisi: { nama: 'Budi', kontak: '081234567890' },
        client: { nama: 'PT ABC', kontak: '089876543210' },
        maintenance_detail: [{ kategori_perangkat: { nama_perangkat: 'Router' } }]
      }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendTomorrowMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6281234567890@c.us', expect.stringContaining('Halo Budi'));
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6289876543210@c.us', expect.stringContaining('Halo PT ABC'));
  });

  test('skips tech when contact missing', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      {
        kode_lokasi: 'LOC002', teknisi: { nama: 'Siti', kontak: null },
        client: { nama: 'PT XYZ', kontak: '089876543210' }, maintenance_detail: []
      }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendTomorrowMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6289876543210@c.us', expect.stringContaining('Halo PT XYZ'));
  });

  test('skips client when contact missing', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      {
        kode_lokasi: 'LOC003', teknisi: { nama: 'Andi', kontak: '081234567890' },
        client: { nama: 'PT DEF', kontak: null }, maintenance_detail: []
      }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendTomorrowMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6281234567890@c.us', expect.stringContaining('Halo Andi'));
  });

  test('handles multiple jobs', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      {
        kode_lokasi: 'LOC001', teknisi: { nama: 'Budi', kontak: '081234567890' },
        client: { nama: 'PT ABC', kontak: '089876543210' },
        maintenance_detail: [{ kategori_perangkat: { nama_perangkat: 'Router' } }]
      },
      {
        kode_lokasi: 'LOC002', teknisi: { nama: 'Siti', kontak: '082345678901' },
        client: { nama: 'PT XYZ', kontak: null },
        maintenance_detail: [{ kategori_perangkat: { nama_perangkat: 'Switch' } }]
      }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendTomorrowMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(3);
  });

  test('uses "Client" fallback', async () => {
    mockClient.isRegisteredUser.mockResolvedValue(true);
    const { from } = buildSupabaseChain([
      {
        kode_lokasi: 'LOC004', teknisi: { nama: 'Dewi', kontak: '081234567890' },
        client: { kontak: '089876543210' }, maintenance_detail: []
      }
    ], null);
    mockSupabase.from.mockImplementation(from);
    await gateway.sendTomorrowMaintenanceReminders();
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '6289876543210@c.us', expect.stringContaining('Halo Client'));
  });
});

describe('initialization', () => {
  test('Client was constructed with LocalAuth', () => {
    expect(Client).toHaveBeenCalledTimes(1);
    expect(Client.mock.calls[0][0].authStrategy).toBeDefined();
  });

  test('client.initialize() was called', () => {
    expect(mockClient.initialize).toHaveBeenCalledTimes(1);
  });

  test('registers qr, ready, and message listeners', () => {
    const events = mockClient.on.mock.calls.map(c => c[0]);
    expect(events).toEqual(expect.arrayContaining(['qr', 'ready', 'message']));
  });
});

describe('qr handler', () => {
  test('calls qrcode.generate with received qr string', () => {
    const qrHandler = mockClient.on.mock.calls.find(c => c[0] === 'qr');
    qrHandler[1]('fake-qr');
    expect(qrcode.generate).toHaveBeenCalledWith('fake-qr', { small: true });
  });
});

describe('ready handler', () => {
  test('schedules two cron jobs on success', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }));
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const readyCall = mockClient.on.mock.calls.find(c => c[0] === 'ready');
    await readyCall[1]();
    expect(mockCron.schedule).toHaveBeenCalledTimes(2);
    expect(mockCron.schedule).toHaveBeenNthCalledWith(
      1, '0 3 * * *', expect.any(Function),
      expect.objectContaining({ timezone: 'Asia/Makassar' }));
    expect(mockCron.schedule).toHaveBeenNthCalledWith(
      2, '0 8 * * *', expect.any(Function),
      expect.objectContaining({ timezone: 'Asia/Makassar' }));
    spy.mockRestore();
  });

  test('logs supabase error on failure', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve({ data: null, error: { message: 'Down' } }))
      }))
    }));
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const readyCall = mockClient.on.mock.calls.find(c => c[0] === 'ready');
    await readyCall[1]();
    expect(spy).toHaveBeenCalledWith('Supabase connection error:', 'Down');
    spy.mockRestore();
  });
});

describe('message handler', () => {
  test('replies pong to !ping', async () => {
    const msgHandler = mockClient.on.mock.calls.find(c => c[0] === 'message');
    const mockMsg = { body: '!ping', reply: jest.fn() };
    await msgHandler[1](mockMsg);
    expect(mockMsg.reply).toHaveBeenCalledWith('pong');
  });

  test('does nothing for non-ping', async () => {
    const msgHandler = mockClient.on.mock.calls.find(c => c[0] === 'message');
    const mockMsg = { body: 'hello', reply: jest.fn() };
    await msgHandler[1](mockMsg);
    expect(mockMsg.reply).not.toHaveBeenCalled();
  });
});