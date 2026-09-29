import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthUser, UpdateProfileParams } from '../types';

export const AUTH_STORAGE_KEY = 'dongato_auth_user';

type AuthListener = (user: AuthUser | null) => void;
const listeners = new Set<AuthListener>();

/**
 * Notifies all active session listeners of auth changes.
 */
export function notifyAuthStateChange(user: AuthUser | null): void {
  listeners.forEach((callback) => {
    try {
      callback(user);
    } catch (err) {
      console.error('Error in auth state listener:', err);
    }
  });
}

/**
 * Translates PostgreSQL/PostgREST error messages into friendly Persian explanations.
 */
export function getPersianAuthErrorMessage(error: any): string {
  if (!error) return 'خطایی رخ داد. لطفاً مجدداً تلاش کنید.';
  const message = (error.message || (typeof error === 'string' ? error : '')).toString();

  // If the error message is already in Persian (from PostgreSQL RPC), return it directly
  if (/[\u0600-\u06FF]/.test(message)) {
    return message;
  }

  const lower = message.toLowerCase();
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('wrong password')
  ) {
    return 'ایمیل یا رمز عبور وارد شده نادرست است.';
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already exists') ||
    lower.includes('duplicate key') ||
    lower.includes('unique constraint')
  ) {
    return 'حسابی با این ایمیل از قبل ثبت‌نام شده است. لطفاً وارد شوید.';
  }
  if (
    lower.includes('password should be at least 6 characters') ||
    lower.includes('weak password')
  ) {
    return 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
  }
  if (lower.includes('invalid email') || lower.includes('email address')) {
    return 'فرمت آدرس ایمیل نامعتبر است.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'خطای اتصال به شبکه. لطفاً وضعیت اینترنت خود را بررسی کنید.';
  }
  if (
    lower.includes('unexpected token') ||
    lower.includes('<html>') ||
    lower.includes('<!doctype')
  ) {
    return 'پاسخ نامعتبر از سرور دریافت شد. لطفاً اتصال سرور و پایگاه داده را بررسی کنید.';
  }

  return message || 'خطا در احراز هویت. لطفاً مجدداً امتحان کنید.';
}

/**
 * Sign Up with Email and Password using PostgreSQL + PostgREST RPC (`signup`)
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('signup', {
        p_name: cleanName,
        p_email: cleanEmail,
        p_password: password,
      });

      if (error) {
        throw new Error(getPersianAuthErrorMessage(error));
      }

      if (!data) {
        throw new Error('ثبت‌نام انجام نشد. لطفاً مجدداً تلاش نمایید.');
      }

      const authUser: AuthUser = {
        id: String(data.id),
        email: String(data.email || cleanEmail),
        displayName: String(data.displayName || data.display_name || cleanName),
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      notifyAuthStateChange(authUser);
      return authUser;
    } catch (err: any) {
      throw new Error(getPersianAuthErrorMessage(err));
    }
  }

  // Offline / LocalStorage Mock Authentication Fallback
  const mockUser: AuthUser = {
    id: `local-user-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email: cleanEmail,
    displayName: cleanName,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
  notifyAuthStateChange(mockUser);
  return mockUser;
}

/**
 * Sign In with Email and Password using PostgreSQL + PostgREST RPC (`login`)
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('login', {
        p_email: cleanEmail,
        p_password: password,
      });

      if (error) {
        throw new Error(getPersianAuthErrorMessage(error));
      }

      if (!data) {
        throw new Error('ایمیل یا رمز عبور اشتباه است.');
      }

      const authUser: AuthUser = {
        id: String(data.id),
        email: String(data.email || cleanEmail),
        displayName: String(
          data.displayName || data.display_name || cleanEmail.split('@')[0]
        ),
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      notifyAuthStateChange(authUser);
      return authUser;
    } catch (err: any) {
      throw new Error(getPersianAuthErrorMessage(err));
    }
  }

  // Offline / LocalStorage Mock Authentication Fallback
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.email === cleanEmail) {
        notifyAuthStateChange(parsed);
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
  notifyAuthStateChange(mockUser);
  return mockUser;
}

// Aliases for backwards compatibility with existing components
export const signUp = signUpWithEmail;
export const signIn = signInWithEmail;

/**
 * Sign Out active session
 */
export async function signOut(): Promise<void> {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  notifyAuthStateChange(null);
}

/**
 * Get current active authenticated user from storage
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as AuthUser;
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
  listeners.add(callback);

  // Synchronously emit current cached state to avoid flash of login modal
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (saved) {
    try {
      callback(JSON.parse(saved));
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }

  // Listen to changes across browser tabs
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
    listeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Updates User Profile (Name, Email, Password) via PostgreSQL RPC (`update_user_profile`)
 */
export async function updateProfileApi(data: UpdateProfileParams): Promise<AuthUser> {
  const cleanName = data.displayName.trim();
  const cleanEmail = data.email.trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: result, error } = await supabase.rpc('update_user_profile', {
        p_name: cleanName,
        p_email: cleanEmail,
        p_current_password: data.currentPassword || null,
        p_new_password: data.newPassword || null,
        p_user_id: data.userId || null,
      });

      if (error) {
        throw new Error(getPersianAuthErrorMessage(error));
      }

      if (!result) {
        throw new Error('ویرایش پروفایل انجام نشد. لطفاً مجدداً تلاش نمایید.');
      }

      const updatedUser: AuthUser = {
        id: String(result.id || data.userId),
        email: String(result.email || cleanEmail),
        displayName: String(result.displayName || result.display_name || cleanName),
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      notifyAuthStateChange(updatedUser);
      return updatedUser;
    } catch (err: any) {
      throw new Error(getPersianAuthErrorMessage(err));
    }
  }

  // Offline / LocalStorage Mock fallback
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  const current: AuthUser = saved
    ? JSON.parse(saved)
    : { id: data.userId || 'local-user', email: cleanEmail, displayName: cleanName };

  const updatedUser: AuthUser = {
    ...current,
    email: cleanEmail,
    displayName: cleanName,
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
  notifyAuthStateChange(updatedUser);
  return updatedUser;
}

