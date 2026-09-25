-- ==============================================================================
-- DONGATO (دنگاتو) - Native PostgreSQL + PostgREST RPC Authentication
-- Lightweight, self-hosted authentication using pgcrypto and PL/pgSQL
-- ==============================================================================

-- 1. Enable pgcrypto for secure cryptographic hashing (bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Protect user passwords: Enable Row Level Security
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- 3. Stored SQL function: signup
CREATE OR REPLACE FUNCTION signup(p_name TEXT, p_email TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_name TEXT;
    v_clean_email TEXT;
    v_new_id UUID;
BEGIN
    v_clean_name := trim(COALESCE(p_name, ''));
    v_clean_email := lower(trim(COALESCE(p_email, '')));

    -- Validation
    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'نام یا نام مستعار الزامی است';
    END IF;

    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'فرمت ایمیل نامعتبر است';
    END IF;

    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'رمز عبور باید حداقل ۶ کاراکتر باشد';
    END IF;

    -- Check duplicate email
    IF EXISTS (SELECT 1 FROM app_users WHERE email = v_clean_email) THEN
        RAISE EXCEPTION 'حسابی با این ایمیل از قبل ثبت‌نام شده است. لطفاً وارد شوید.';
    END IF;

    -- Insert user with bcrypt hashed password
    INSERT INTO app_users (email, password_hash, display_name)
    VALUES (
        v_clean_email,
        crypt(p_password, gen_salt('bf', 10)),
        v_clean_name
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'id', v_new_id,
        'email', v_clean_email,
        'displayName', v_clean_name,
        'display_name', v_clean_name
    );
END;
$$;

-- 4. Stored SQL function: login
CREATE OR REPLACE FUNCTION login(p_email TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_email TEXT;
    v_user RECORD;
BEGIN
    v_clean_email := lower(trim(COALESCE(p_email, '')));

    IF v_clean_email = '' OR p_password IS NULL THEN
        RAISE EXCEPTION 'ایمیل و رمز عبور الزامی است';
    END IF;

    SELECT id, email, display_name, password_hash
    INTO v_user
    FROM app_users
    WHERE email = v_clean_email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ایمیل یا رمز عبور اشتباه است';
    END IF;

    IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        RAISE EXCEPTION 'ایمیل یا رمز عبور اشتباه است';
    END IF;

    RETURN jsonb_build_object(
        'id', v_user.id,
        'email', v_user.email,
        'displayName', v_user.display_name,
        'display_name', v_user.display_name
    );
END;
$$;

-- 5. Grant execute permissions to PostgREST roles
GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login(TEXT, TEXT) TO anon, authenticated;

-- Notify PostgREST to reload its schema cache
DO $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
