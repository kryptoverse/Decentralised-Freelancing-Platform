import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Check if Supabase is configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

// Server-side Supabase client (uses service role key, bypasses RLS)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
    ? createClient<Database>(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Check if database caching is enabled
 * Returns false if:
 * - ENABLE_DB_CACHE is explicitly set to 'false'
 * - Supabase is not configured
 */
export function isCacheEnabled(): boolean {
    const cacheFlag = process.env.ENABLE_DB_CACHE;

    // If explicitly disabled, return false
    if (cacheFlag === 'false') {
        return false;
    }

    // If Supabase is not configured, caching is not available
    if (!supabase) {
        console.warn('Supabase not configured - caching disabled');
        return false;
    }

    return true;
}

/**
 * Get cache TTL in milliseconds
 * Default: 5 minutes
 */
export function getCacheTTL(): number {
    const ttl = process.env.CACHE_TTL_MS;
    return ttl ? parseInt(ttl, 10) : 5 * 60 * 1000; // 5 minutes default
}

/**
 * Check if cached data is still fresh
 */
export function isCacheFresh(syncedAt: string | Date): boolean {
    const syncTime = new Date(syncedAt).getTime();
    const now = Date.now();
    const age = now - syncTime;

    return age < getCacheTTL();
}

/**
 * Safe wrapper for Supabase queries with error handling
 */
export async function safeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
    if (!isCacheEnabled()) {
        return null;
    }

    try {
        const { data, error } = await queryFn();

        if (error) {
            console.warn('Supabase query error:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.warn('Supabase query exception:', err);
        return null;
    }
}
