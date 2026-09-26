import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Checks whether valid Supabase credentials have been injected via environment variables.
 * Disqualifies default templates or empty strings.
 */
export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseUrl.startsWith('http')
);

/**
 * Validates whether a token string adheres to the standard 3-segment dot-separated
 * Base64URL-encoded JWT structure (header.payload.signature) and is not a placeholder/dummy value.
 */
function isValidJwt(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return false;

  const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
  for (const part of parts) {
    if (!part || !base64UrlPattern.test(part)) {
      return false;
    }
    // Base64URL strings cannot have length % 4 === 1
    if (part.length % 4 === 1) {
      return false;
    }
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('dummy') ||
    lower.includes('placeholder') ||
    lower.includes('your-anon-key') ||
    lower.endsWith('.signature')
  ) {
    return false;
  }

  return true;
}

/**
 * Custom fetch implementation for Supabase client.
 * Intercepts outgoing requests to strip invalid/dummy Authorization bearer tokens
 * so self-hosted PostgREST automatically falls back to PGRST_DB_ANON_ROLE = anon.
 */
const customFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const authHeader = headers.get('Authorization') || headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!isValidJwt(token)) {
      headers.delete('Authorization');
      headers.delete('authorization');
    }
  }

  // Ensure apikey header is maintained safely if configured
  if (!headers.get('apikey') && supabaseAnonKey) {
    headers.set('apikey', supabaseAnonKey);
  }

  if (input instanceof Request) {
    return fetch(new Request(input, { ...init, headers }));
  }

  return fetch(input, {
    ...init,
    headers,
  });
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Managed natively via localStorage & RPC
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: customFetch,
      },
    })
  : null;

