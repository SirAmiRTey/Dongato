-- ==============================================================================
-- DONGATO (دنگاتو) - Outbox Email Notification Engine Schema & Triggers
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
