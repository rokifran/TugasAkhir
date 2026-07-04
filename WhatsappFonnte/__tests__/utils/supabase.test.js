jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('supabase utils', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules(); // clears the cache
        process.env = { ...originalEnv }; // make a copy
    });

    afterAll(() => {
        process.env = originalEnv; // restore original env
    });

    it('should throw an error if SUPABASE_URL is missing', () => {
        delete process.env.SUPABASE_URL;
        process.env.SUPABASE_KEY = 'test_key';
        
        expect(() => {
            require('../../utils/supabase');
        }).toThrow('Supabase URL or Key is missing');
    });

    it('should throw an error if SUPABASE_KEY is missing', () => {
        process.env.SUPABASE_URL = 'http://test.com';
        delete process.env.SUPABASE_KEY;
        
        expect(() => {
            require('../../utils/supabase');
        }).toThrow('Supabase URL or Key is missing');
    });

    it('should initialize and export supabase client if env vars are present', () => {
        process.env.SUPABASE_URL = 'http://test.com';
        process.env.SUPABASE_KEY = 'test_key';
        
        const supabase = require('../../utils/supabase');
        // createClient just returns an object with methods. We can check if it's truthy.
        expect(supabase).toBeDefined();
        // Since we didn't mock createClient, it should be a real SupabaseClient instance
        // But checking if it has a 'from' method is enough
        expect(typeof supabase.from).toBe('function');
    });
});
