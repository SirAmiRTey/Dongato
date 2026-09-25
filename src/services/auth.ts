import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthUser } from '../types';

export const AUTH_STORAGE_KEY = 'dongato_auth_user';

/**
 * Translates Supabase auth errors into friendly Persian explanations.
 */
export function getPersianAuthErrorMessage(error: any): string {
  if (!error) return 'خطایی رخ داد. لطفاً مجدداً تلاش کنید.';
  const message = (error.message || '').toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'ایمیل یا رمز عبور وارد شده نادرست است.';
  }
  if (message.includes('user already registered') || message.includes('already exists')) {
    return 'حسابی با این ایمیل از قبل ثبت‌نام شده است. لطفاً وارد شوید.';
  }
  if (message.includes('password should be at least 6 characters') || message.includes('weak password')) {
    return 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
  }
  if (message.includes('invalid email') || message.includes('email address')) {
    return 'فرمت ایمیل نامعتبر است.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'خطای اتصال به شبکه. لطفاً وضعیت اینترنت خود را بررسی کنید.';
  }
  if (message.includes('email not confirmed')) {
    return 'ایمیل شما هنوز تأیید نشده است. لطفاً صندوق ایمیل خود را بررسی کنید.';
  }
  return error.message || 'خطا در احراز هویت. لطفاً مجدداً امتحان کنید.';
}

/**
 * Helper to convert Supabase User object to our app's AuthUser
 */
function toAuthUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    displayName:
      user.user_metadata?.full_name ||
      user.user_metadata?.displayName ||
      user.email?.split('@')[0] ||
      'هم‌اتاقی',
  };
}

/**
 * Sign Up with Email and Password
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
        },
      },
    });

    if (error) {
      throw new Error(getPersianAuthErrorMessage(error));
    }

    if (!data.user) {
      throw new Error('ثبت‌نام انجام نشد. لطفاً مجدداً تلاش نمایید.');
    }

    const authUser = toAuthUser(data.user);
    // Cache for offline resilience
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  }

  // Offline / LocalStorage Mock Authentication Fallback
  const mockUser: AuthUser = {
    id: `local-user-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email: cleanEmail,
    displayName: cleanName,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
  return mockUser;
}

/**
 * Sign In with Email and Password
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      throw new Error(getPersianAuthErrorMessage(error));
    }

    if (!data.user) {
      throw new Error('ورود ناموفق بود.');
    }

    const authUser = toAuthUser(data.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  }

  // Offline / LocalStorage Mock Authentication Fallback
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.email === cleanEmail) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  const mockUser: AuthUser = {
    id: `local-user-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0],
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
  return mockUser;
}

/**
 * Sign Out active session
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    }
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Get current active authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const authUser = toAuthUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        return authUser;
      }
    } catch (err) {
      console.warn('Error fetching supabase user:', err);
    }
  }

  // Check localStorage fallback
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Listen to auth state transitions
 */
export function onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
  if (isSupabaseConfigured && supabase) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const authUser = toAuthUser(session.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        callback(authUser);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  // Offline mock event listener (storage events or initial sync)
  const initial = localStorage.getItem(AUTH_STORAGE_KEY);
  if (initial) {
    try {
      callback(JSON.parse(initial));
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === AUTH_STORAGE_KEY) {
      if (e.newValue) {
        try {
          callback(JSON.parse(e.newValue));
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  };

  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}
