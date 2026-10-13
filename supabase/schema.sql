-- ==============================================================================
-- DONGATO (دنگاتو) - Database Schema Migration
-- Direct P2P Room Expense Sharing
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: rooms
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_by UUID, -- Set after member creation or deferred FK
    currency TEXT NOT NULL DEFAULT 'تومان',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. Table: members
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    color TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true, -- Soft-delete invariant
    card_number TEXT,
    bank_name TEXT,
    user_id UUID, -- Link to auth.users (Supabase Auth)
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent check for members.user_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE members ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Deferred constraint for rooms.created_by -> members.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_created_by'
    ) THEN
        ALTER TABLE rooms
        ADD CONSTRAINT fk_rooms_created_by
        FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Table: expenses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_amount BIGINT NOT NULL CHECK (total_amount > 0),
    paid_by_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    category TEXT NOT NULL DEFAULT 'other',
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent column check for existing expenses table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'receipt_url'
    ) THEN
        ALTER TABLE expenses ADD COLUMN receipt_url TEXT;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Table: splits
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount >= 0),
    percentage NUMERIC(5, 2),
    CONSTRAINT unique_expense_member UNIQUE (expense_id, member_id)
);

-- ------------------------------------------------------------------------------
-- 5. Table: settlements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 6. Table: activity_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES members(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Indexes for High Performance
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_members_room_id ON members(room_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_room_id_created_at ON expenses(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_splits_expense_id ON splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_member_id ON splits(member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_room_id_status ON settlements(room_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_room_id_created_at ON activity_logs(room_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Permissive Policies
-- ------------------------------------------------------------------------------
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for anonymous room access
DROP POLICY IF EXISTS "Public read on rooms" ON rooms;
CREATE POLICY "Public read on rooms" ON rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert on rooms" ON rooms;
CREATE POLICY "Public insert on rooms" ON rooms FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update on rooms" ON rooms;
CREATE POLICY "Public update on rooms" ON rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read on members" ON members;
CREATE POLICY "Public read on members" ON members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert on members" ON members;
CREATE POLICY "Public insert on members" ON members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update on members" ON members;
CREATE POLICY "Public update on members" ON members FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read on expenses" ON expenses;
CREATE POLICY "Public read on expenses" ON expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert on expenses" ON expenses;
CREATE POLICY "Public insert on expenses" ON expenses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update on expenses" ON expenses;
CREATE POLICY "Public update on expenses" ON expenses FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public delete on expenses" ON expenses;
CREATE POLICY "Public delete on expenses" ON expenses FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read on splits" ON splits;
CREATE POLICY "Public read on splits" ON splits FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert on splits" ON splits;
CREATE POLICY "Public insert on splits" ON splits FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update on splits" ON splits;
CREATE POLICY "Public update on splits" ON splits FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public delete on splits" ON splits;
CREATE POLICY "Public delete on splits" ON splits FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read on settlements" ON settlements;
CREATE POLICY "Public read on settlements" ON settlements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert on settlements" ON settlements;
CREATE POLICY "Public insert on settlements" ON settlements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update on settlements" ON settlements;
CREATE POLICY "Public update on settlements" ON settlements FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read on activity_logs" ON activity_logs;
CREATE POLICY "Public read on activity_logs" ON activity_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert on activity_logs" ON activity_logs;
CREATE POLICY "Public insert on activity_logs" ON activity_logs FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- Supabase Realtime Publication
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
        ALTER PUBLICATION supabase_realtime ADD TABLE members;
        ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
        ALTER PUBLICATION supabase_realtime ADD TABLE splits;
        ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
        ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or permissions restricted
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 7. Supabase Storage: 'receipts' Bucket & RLS
-- ------------------------------------------------------------------------------
-- Ensure storage schema and tables exist in self-hosted Postgres environments
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public BOOLEAN DEFAULT false,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT,
    owner UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB
);
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO anon, authenticated;

-- Create the public receipts storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg'];

-- Storage Policies for receipts bucket
DO $$
BEGIN
    -- Allow public read access to receipts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Receipts' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Public Access Receipts" ON storage.objects
        FOR SELECT USING (bucket_id = 'receipts');
    END IF;

    -- Allow authenticated/anon upload to receipts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Upload Receipts' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Public Upload Receipts" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'receipts');
    END IF;

    -- Allow public update to receipts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Update Receipts' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Public Update Receipts" ON storage.objects
        FOR UPDATE USING (bucket_id = 'receipts');
    END IF;

    -- Allow public delete to receipts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Delete Receipts' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Public Delete Receipts" ON storage.objects
        FOR DELETE USING (bucket_id = 'receipts');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. Native PostgreSQL + PostgREST RPC Authentication
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

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

    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'نام یا نام مستعار الزامی است';
    END IF;

    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'فرمت ایمیل نامعتبر است';
    END IF;

    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'رمز عبور باید حداقل ۶ کاراکتر باشد';
    END IF;

    IF EXISTS (SELECT 1 FROM app_users WHERE email = v_clean_email) THEN
        RAISE EXCEPTION 'حسابی با این ایمیل از قبل ثبت‌نام شده است. لطفاً وارد شوید.';
    END IF;

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

GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login(TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- Outbox Email Notification Engine Schema & Triggers
-- ==============================================================================

-- 1. Table: email_queue (Transactional Outbox Pattern)
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('NEW_EXPENSE', 'SETTLEMENT_PENDING', 'SETTLEMENT_CONFIRMED')),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

-- Index for high-throughput locking and polling: status and creation order
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);

-- Row Level Security (RLS)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Grant permissions for service and application roles
GRANT ALL ON email_queue TO postgres;
GRANT SELECT, INSERT ON email_queue TO anon, authenticated;

-- Ensure settlements has is_settled column for status synchronization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlements' AND column_name = 'is_settled'
    ) THEN
        ALTER TABLE settlements ADD COLUMN is_settled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Trigger Function: trigger_notify_expense_split
-- Fires when an expense split is assigned to a roommate.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_notify_expense_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_recipient_email TEXT;
    v_recipient_name TEXT;
    v_member_name TEXT;
    v_expense_title TEXT;
    v_total_amount BIGINT;
    v_paid_by_id UUID;
    v_room_id UUID;
    v_room_name TEXT;
    v_payer_name TEXT;
BEGIN
    -- 1. Fetch expense details
    SELECT e.title, e.total_amount, e.paid_by_id, e.room_id, r.name
    INTO v_expense_title, v_total_amount, v_paid_by_id, v_room_id, v_room_name
    FROM expenses e
    JOIN rooms r ON r.id = e.room_id
    WHERE e.id = NEW.expense_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- 2. Do not notify if recipient is the payer themselves
    IF NEW.member_id = v_paid_by_id THEN
        RETURN NEW;
    END IF;

    -- 3. Fetch recipient member & user email
    SELECT m.name, u.email, u.display_name
    INTO v_member_name, v_recipient_email, v_recipient_name
    FROM members m
    LEFT JOIN app_users u ON u.id = m.user_id
    WHERE m.id = NEW.member_id;

    -- 4. Check if recipient has a valid email address
    IF v_recipient_email IS NULL OR v_recipient_email = '' OR v_recipient_email NOT LIKE '%@%.%' THEN
        RETURN NEW;
    END IF;

    -- 5. Fetch payer member name
    SELECT name INTO v_payer_name
    FROM members
    WHERE id = v_paid_by_id;

    -- 6. Enqueue email notification
    INSERT INTO email_queue (
        recipient_email,
        recipient_name,
        template_type,
        payload
    ) VALUES (
        v_recipient_email,
        COALESCE(v_recipient_name, v_member_name, 'هم‌اتاقی'),
        'NEW_EXPENSE',
        jsonb_build_object(
            'room_id', v_room_id,
            'room_name', COALESCE(v_room_name, 'اتاق دنگاتو'),
            'expense_id', NEW.expense_id,
            'expense_title', COALESCE(v_expense_title, 'هزینه جدید'),
            'total_amount', v_total_amount,
            'user_share', NEW.amount,
            'payer_name', COALESCE(v_payer_name, 'هم‌اتاقی'),
            'currency', 'تومان'
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_expense_split failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Attach trigger to splits table
DROP TRIGGER IF EXISTS trg_notify_expense_split ON splits;
CREATE TRIGGER trg_notify_expense_split
AFTER INSERT ON splits
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_expense_split();

-- Optional alias trigger if expense_splits table is present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'expense_splits') THEN
        DROP TRIGGER IF EXISTS trg_notify_expense_splits_alias ON expense_splits;
        CREATE TRIGGER trg_notify_expense_splits_alias
        AFTER INSERT ON expense_splits
        FOR EACH ROW
        EXECUTE FUNCTION trigger_notify_expense_split();
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Trigger Function: trigger_notify_settlement_pending
-- Fires when a settlement payment request is submitted.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_notify_settlement_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_receiver_email TEXT;
    v_receiver_name TEXT;
    v_receiver_member_name TEXT;
    v_payer_name TEXT;
    v_room_name TEXT;
BEGIN
    -- 1. Fetch receiver member & user email
    SELECT m.name, u.email, u.display_name
    INTO v_receiver_member_name, v_receiver_email, v_receiver_name
    FROM members m
    LEFT JOIN app_users u ON u.id = m.user_id
    WHERE m.id = NEW.receiver_id;

    -- 2. Verify receiver has an email
    IF v_receiver_email IS NULL OR v_receiver_email = '' OR v_receiver_email NOT LIKE '%@%.%' THEN
        RETURN NEW;
    END IF;

    -- 3. Fetch payer name & room name
    SELECT name INTO v_payer_name FROM members WHERE id = NEW.payer_id;
    SELECT name INTO v_room_name FROM rooms WHERE id = NEW.room_id;

    -- 4. Enqueue SETTLEMENT_PENDING email
    INSERT INTO email_queue (
        recipient_email,
        recipient_name,
        template_type,
        payload
    ) VALUES (
        v_receiver_email,
        COALESCE(v_receiver_name, v_receiver_member_name, 'هم‌اتاقی'),
        'SETTLEMENT_PENDING',
        jsonb_build_object(
            'room_id', NEW.room_id,
            'room_name', COALESCE(v_room_name, 'اتاق دنگاتو'),
            'settlement_id', NEW.id,
            'amount', NEW.amount,
            'payer_name', COALESCE(v_payer_name, 'هم‌اتاقی'),
            'currency', 'تومان',
            'notes', NEW.notes
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_settlement_pending failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_settlement_pending ON settlements;
CREATE TRIGGER trg_notify_settlement_pending
AFTER INSERT ON settlements
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_settlement_pending();

-- ------------------------------------------------------------------------------
-- 4. Trigger Function: trigger_notify_settlement_confirmed
-- Fires when a settlement is confirmed by the receiver.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_notify_settlement_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payer_email TEXT;
    v_payer_name TEXT;
    v_payer_member_name TEXT;
    v_receiver_name TEXT;
    v_room_name TEXT;
BEGIN
    -- Check if settlement just transitioned to confirmed
    IF (NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed'))
       OR (COALESCE(NEW.is_settled, false) = true AND COALESCE(OLD.is_settled, false) = false) THEN

        -- 1. Fetch payer member & user email
        SELECT m.name, u.email, u.display_name
        INTO v_payer_member_name, v_payer_email, v_payer_name
        FROM members m
        LEFT JOIN app_users u ON u.id = m.user_id
        WHERE m.id = NEW.payer_id;

        -- 2. Verify payer has an email
        IF v_payer_email IS NULL OR v_payer_email = '' OR v_payer_email NOT LIKE '%@%.%' THEN
            RETURN NEW;
        END IF;

        -- 3. Fetch receiver name & room name
        SELECT name INTO v_receiver_name FROM members WHERE id = NEW.receiver_id;
        SELECT name INTO v_room_name FROM rooms WHERE id = NEW.room_id;

        -- 4. Enqueue SETTLEMENT_CONFIRMED email
        INSERT INTO email_queue (
            recipient_email,
            recipient_name,
            template_type,
            payload
        ) VALUES (
            v_payer_email,
            COALESCE(v_payer_name, v_payer_member_name, 'هم‌اتاقی'),
            'SETTLEMENT_CONFIRMED',
            jsonb_build_object(
                'room_id', NEW.room_id,
                'room_name', COALESCE(v_room_name, 'اتاق دنگاتو'),
                'settlement_id', NEW.id,
                'amount', NEW.amount,
                'receiver_name', COALESCE(v_receiver_name, 'هم‌اتاقی'),
                'currency', 'تومان'
            )
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_notify_settlement_confirmed failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_settlement_confirmed ON settlements;
CREATE TRIGGER trg_notify_settlement_confirmed
AFTER UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_settlement_confirmed();

-- ==============================================================================
-- User Profile & Bank Card Management Engine
-- ==============================================================================

-- 1. Table: bank_cards
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

CREATE INDEX IF NOT EXISTS idx_bank_cards_user_id ON bank_cards(user_id);
ALTER TABLE bank_cards ENABLE ROW LEVEL SECURITY;

GRANT ALL ON bank_cards TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_cards TO anon, authenticated;

-- 2. Trigger: enforce single default bank card per user
CREATE OR REPLACE FUNCTION trigger_enforce_single_default_bank_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (SELECT 1 FROM bank_cards WHERE user_id = NEW.user_id) THEN
            NEW.is_default := true;
        END IF;
    END IF;

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

-- 3. Stored RPC: set_default_bank_card
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

-- 4. Stored RPC: update_user_profile
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

    IF v_clean_email != v_user.email THEN
        IF EXISTS (SELECT 1 FROM app_users WHERE email = v_clean_email AND id != v_user.id) THEN
            RAISE EXCEPTION 'این ایمیل قبلاً توسط حساب دیگری ثبت‌نام شده است';
        END IF;
    END IF;

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

        UPDATE app_users
        SET password_hash = crypt(p_new_password, gen_salt('bf', 10))
        WHERE id = v_user.id;
    END IF;

    UPDATE app_users
    SET display_name = v_clean_name,
        email = v_clean_email
    WHERE id = v_user.id;

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

-- ==============================================================================
-- Debt Simplification Engine (View & RPC)
-- ==============================================================================

-- 1. View: view_room_net_balances
CREATE OR REPLACE VIEW view_room_net_balances AS
WITH member_spending AS (
    SELECT 
        m.id AS member_id,
        m.room_id,
        m.name AS member_name,
        COALESCE(exp_paid.amount, 0) + COALESCE(sett_paid.amount, 0) AS total_paid,
        COALESCE(exp_share.amount, 0) + COALESCE(sett_recv.amount, 0) AS total_share
    FROM members m
    LEFT JOIN (
        SELECT paid_by_id, SUM(total_amount) AS amount
        FROM expenses
        GROUP BY paid_by_id
    ) exp_paid ON exp_paid.paid_by_id = m.id
    LEFT JOIN (
        SELECT s.member_id, SUM(s.amount) AS amount
        FROM splits s
        JOIN expenses e ON e.id = s.expense_id
        GROUP BY s.member_id
    ) exp_share ON exp_share.member_id = m.id
    LEFT JOIN (
        SELECT payer_id, SUM(amount) AS amount
        FROM settlements
        WHERE status = 'confirmed'
        GROUP BY payer_id
    ) sett_paid ON sett_paid.payer_id = m.id
    LEFT JOIN (
        SELECT receiver_id, SUM(amount) AS amount
        FROM settlements
        WHERE status = 'confirmed'
        GROUP BY receiver_id
    ) sett_recv ON sett_recv.receiver_id = m.id
)
SELECT 
    member_id,
    room_id,
    member_name,
    total_paid,
    total_share,
    (total_paid - total_share) AS net_balance
FROM member_spending;

-- 2. Stored Procedure / RPC: get_simplified_debts
-- Computes strictly bilateral (pairwise) net debts between all pairs of members in a room.
-- Does NOT shift, pool, or transfer debts across other room members.
CREATE OR REPLACE FUNCTION get_simplified_debts(p_room_id UUID)
RETURNS TABLE (
    debtor_id UUID,
    debtor_name TEXT,
    creditor_id UUID,
    creditor_name TEXT,
    amount BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH pairs AS (
        SELECT 
            m1.id AS member_a_id,
            m1.name AS member_a_name,
            m2.id AS member_b_id,
            m2.name AS member_b_name
        FROM members m1
        JOIN members m2 ON m1.room_id = m2.room_id AND m1.id < m2.id
        WHERE m1.room_id = p_room_id
    ),
    pairwise_direct AS (
        SELECT 
            p.member_a_id,
            p.member_a_name,
            p.member_b_id,
            p.member_b_name,
            -- Direct expenses where A paid and B was split + confirmed settlements A paid B
            COALESCE((
                SELECT SUM(s.amount)
                FROM splits s
                JOIN expenses e ON e.id = s.expense_id
                WHERE e.paid_by_id = p.member_a_id 
                  AND s.member_id = p.member_b_id
                  AND e.room_id = p_room_id
            ), 0) +
            COALESCE((
                SELECT SUM(st.amount)
                FROM settlements st
                WHERE st.payer_id = p.member_a_id 
                  AND st.receiver_id = p.member_b_id 
                  AND st.status = 'confirmed'
                  AND st.room_id = p_room_id
            ), 0) AS a_to_b,
            -- Direct expenses where B paid and A was split + confirmed settlements B paid A
            COALESCE((
                SELECT SUM(s.amount)
                FROM splits s
                JOIN expenses e ON e.id = s.expense_id
                WHERE e.paid_by_id = p.member_b_id 
                  AND s.member_id = p.member_a_id
                  AND e.room_id = p_room_id
            ), 0) +
            COALESCE((
                SELECT SUM(st.amount)
                FROM settlements st
                WHERE st.payer_id = p.member_b_id 
                  AND st.receiver_id = p.member_a_id 
                  AND st.status = 'confirmed'
                  AND st.room_id = p_room_id
            ), 0) AS b_to_a
        FROM pairs p
    ),
    net_pairs AS (
        SELECT 
            member_a_id,
            member_a_name,
            member_b_id,
            member_b_name,
            (a_to_b - b_to_a)::BIGINT AS net_a_to_b
        FROM pairwise_direct
    )
    SELECT 
        CASE WHEN net_a_to_b < 0 THEN member_a_id ELSE member_b_id END AS debtor_id,
        CASE WHEN net_a_to_b < 0 THEN member_a_name ELSE member_b_name END AS debtor_name,
        CASE WHEN net_a_to_b < 0 THEN member_b_id ELSE member_a_id END AS creditor_id,
        CASE WHEN net_a_to_b < 0 THEN member_b_name ELSE member_a_name END AS creditor_name,
        ABS(net_a_to_b)::BIGINT AS amount
    FROM net_pairs
    WHERE net_a_to_b != 0;
END;
$$;

GRANT SELECT ON view_room_net_balances TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_simplified_debts(UUID) TO anon, authenticated;




