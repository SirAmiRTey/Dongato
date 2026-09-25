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

