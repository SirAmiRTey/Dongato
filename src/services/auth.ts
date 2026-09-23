import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthUser } from '../types';

export const AUTH_STORAGE_KEY = 'dongato_auth_user';

function translateAuthError(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'این ایمیل قبلاً در سامانه ثبت شده است. لطفاً وارد شوید.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'ایمیل یا رمز عبور اشتباه است.';
  }
  if (lower.includes('password') && (lower.includes('short') || lower.includes('least 6'))) {
    return 'رمز عبور باید حداقل شامل ۶ کاراکتر باشد.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'تعداد دفعات تلاش بیش از حد مجاز بوده است. لطفاً دقایقی بعد امتحان کنید.';
  }
  if (lower.includes('email not confirmed')) {
    return 'ایمیل شما هنوز تأیید نشده است.';
  }
  if (lower.includes('valid email')) {
    return 'لطفاً یک آدرس ایمیل معتبر وارد کنید.';
  }
  return errorMsg || 'خطایی در ارتباط با سرور رخ داد.';
}

function mapSupabaseUser(user: any): AuthUser {
  const meta = user.user_metadata || {};
  const displayName = meta.full_name || meta.display_name || user.email?.split('@')[0] || 'کاربر دنگاتو';
  return {
    id: user.id,
    email: user.email || '',
    displayName,
    avatarUrl: meta.avatar_url,
  };
}

/**
 * Sign Up with Email, Password, and Display Name.
 */
export async function signUpUser(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();

  if (!cleanName) {
    throw new Error('لطفاً نام و نام خانوادگی خود را وارد نمایید.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('لطفاً یک آدرس ایمیل معتبر وارد نمایید.');
  }
  if (password.length < 6) {
    throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          display_name: cleanName,
        },
      },
    });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }

    if (!data.user) {
      throw new Error('ثبت‌نام انجام نشد؛ لطفاً دوباره تلاش نمایید.');
    }

    const authUser = mapSupabaseUser(data.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  }

  // Fallback Mock Authentication
  const mockUser: AuthUser = {
    id: `usr-${Date.now().toString(36)}`,
    email: cleanEmail,
    displayName: cleanName,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
  return mockUser;
}

/**
 * Sign In with Email and Password.
 */
export async function signInUser(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('لطفاً یک آدرس ایمیل معتبر وارد نمایید.');
  }
  if (!password) {
    throw new Error('لطفاً رمز عبور خود را وارد نمایید.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      throw new Error(translateAuthError(error.message));
    }

    if (!data.user) {
      throw new Error('کاربر یافت نشد؛ لطفاً مجدداً وارد شوید.');
    }

    const authUser = mapSupabaseUser(data.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  }

  // Fallback Mock Authentication
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.email === cleanEmail) {
        return parsed;
      }
    } catch {
      // ignore parse error
    }
  }

  const defaultMock: AuthUser = {
    id: 'usr-demo-1',
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0] || 'کاربر نمونه',
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaultMock));
  return defaultMock;
}

/**
 * Sign Out from the current session.
 */
export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase sign-out notice:', err);
    }
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Retrieves the current session user on initial page load.
 */
export async function getInitialAuthUser(): Promise<AuthUser | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = mapSupabaseUser(session.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        return user;
      }
    } catch (err) {
      console.warn('Session check failed, trying local storage cache:', err);
    }
  }

  // Read local cache
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
 * Subscribes to authentication state changes (login, logout, token refresh).
 */
export function subscribeToAuthChanges(callback: (user: AuthUser | null) => void): () => void {
  if (isSupabaseConfigured && supabase) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const mapped = mapSupabaseUser(session.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mapped));
        callback(mapped);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  // Offline mock mode: return noop
  return () => {};
}
