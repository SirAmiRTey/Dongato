-- ==============================================================================
-- DONGATO (دنگاتو) - User Profile & Bank Card Management Engine Migration
-- ==============================================================================

-- 1. Create table: bank_cards
CREATE TABLE IF NOT EXISTS bank_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    card_number VARCHAR(16) NOT NULL,
    shaba_number VARCHAR(26),
    card_holder_name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user card retrieval
CREATE INDEX IF NOT EXISTS idx_bank_cards_user_id ON bank_cards(user_id);

-- Enable Row Level Security
ALTER TABLE bank_cards ENABLE ROW LEVEL SECURITY;

-- PostgREST role permissions
GRANT ALL ON bank_cards TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_cards TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Trigger to ensure single default card per user
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_enforce_single_default_bank_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If this is the user's first card, ensure is_default is true
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM bank_cards WHERE user_id = NEW.user_id) THEN
            NEW.is_default := true;
        END IF;
    END IF;

    -- If is_default is being set to true, reset all other cards for this user
    IF NEW.is_default = true THEN
        UPDATE bank_cards
        SET is_default = false
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_cards_single_default ON bank_cards;
CREATE TRIGGER trg_bank_cards_single_default
BEFORE INSERT OR UPDATE OF is_default ON bank_cards
FOR EACH ROW
EXECUTE FUNCTION trigger_enforce_single_default_bank_card();

-- ------------------------------------------------------------------------------
-- 3. Stored RPC: set_default_bank_card
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_default_bank_card(
    p_card_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM bank_cards
    WHERE id = p_card_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'کارت بانکی مورد نظر یافت نشد';
    END IF;

    -- If p_user_id is passed, verify ownership
    IF p_user_id IS NOT NULL AND v_user_id != p_user_id THEN
        RAISE EXCEPTION 'دسترسی غیرمجاز به این کارت بانکی';
    END IF;

    UPDATE bank_cards
    SET is_default = false
    WHERE user_id = v_user_id;

    UPDATE bank_cards
    SET is_default = true
    WHERE id = p_card_id;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION set_default_bank_card(UUID, UUID) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Stored RPC: update_user_profile
-- Updates display_name, email, and optionally password with verification
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_user_profile(
    p_name TEXT,
    p_email TEXT,
    p_current_password TEXT DEFAULT NULL,
    p_new_password TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_user_id UUID;
    v_clean_name TEXT;
    v_clean_email TEXT;
    v_user app_users%ROWTYPE;
BEGIN
    v_clean_name := trim(COALESCE(p_name, ''));
    v_clean_email := lower(trim(COALESCE(p_email, '')));

    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'نام یا نام مستعار نمی‌تواند خالی باشد';
    END IF;

    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'فرمت آدرس ایمیل نامعتبر است';
    END IF;

    -- Determine user: 1) explicit p_user_id, 2) JWT claims sub, 3) fallback by email
    IF p_user_id IS NOT NULL THEN
        v_target_user_id := p_user_id;
    ELSE
        BEGIN
            v_target_user_id := nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_target_user_id := NULL;
        END;
    END IF;

    IF v_target_user_id IS NOT NULL THEN
        SELECT * INTO v_user FROM app_users WHERE id = v_target_user_id;
    ELSE
        SELECT * INTO v_user FROM app_users WHERE email = v_clean_email;
    END IF;

    IF v_user.id IS NULL THEN
        RAISE EXCEPTION 'کاربر مورد نظر یافت نشد یا احراز هویت نامعتبر است';
    END IF;

    -- Check if email changed and is taken by another account
    IF v_clean_email != v_user.email THEN
        IF EXISTS (SELECT 1 FROM app_users WHERE email = v_clean_email AND id != v_user.id) THEN
            RAISE EXCEPTION 'این ایمیل قبلاً توسط حساب دیگری ثبت‌نام شده است';
        END IF;
    END IF;

    -- Password change verification if new password requested
    IF p_new_password IS NOT NULL AND trim(p_new_password) != '' THEN
        IF p_current_password IS NULL OR trim(p_current_password) = '' THEN
            RAISE EXCEPTION 'برای تغییر رمز عبور، وارد کردن رمز عبور فعلی الزامی است';
        END IF;

        IF v_user.password_hash != crypt(p_current_password, v_user.password_hash) THEN
            RAISE EXCEPTION 'رمز عبور فعلی نادرست است';
        END IF;

        IF length(p_new_password) < 6 THEN
            RAISE EXCEPTION 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد';
        END IF;

        -- Update password
        UPDATE app_users
        SET password_hash = crypt(p_new_password, gen_salt('bf', 10))
        WHERE id = v_user.id;
    END IF;

    -- Update display_name and email
    UPDATE app_users
    SET display_name = v_clean_name,
        email = v_clean_email
    WHERE id = v_user.id;

    -- Sync display_name to connected room members
    UPDATE members
    SET name = v_clean_name
    WHERE user_id = v_user.id;

    RETURN jsonb_build_object(
        'id', v_user.id,
        'email', v_clean_email,
        'displayName', v_clean_name,
        'display_name', v_clean_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_profile(TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- Reload PostgREST schema cache
DO $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
