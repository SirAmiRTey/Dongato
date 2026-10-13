-- ==============================================================================
-- DONGATO (دنگاتو) - Debt Simplification Engine (View & RPC)
-- Optimizes room settlements by calculating net member balances (Total Paid - Total Share)
-- and matching debtors to creditors with minimum cash flow transactions.
-- ==============================================================================

-- 1. View: view_room_net_balances
-- Aggregates total paid, total split share, and confirmed settlements for each member
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
-- Returns simplified settlement transactions (debtor -> creditor -> amount) for a room
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
DECLARE
    debtor_ids UUID[];
    debtor_names TEXT[];
    debtor_amounts BIGINT[];
    creditor_ids UUID[];
    creditor_names TEXT[];
    creditor_amounts BIGINT[];
    d_idx INT := 1;
    c_idx INT := 1;
    d_count INT;
    c_count INT;
    v_settle BIGINT;
BEGIN
    -- Collect debtors ordered by debt descending (most negative balance first)
    SELECT 
        COALESCE(array_agg(m_id ORDER BY net_bal ASC), ARRAY[]::UUID[]),
        COALESCE(array_agg(m_name ORDER BY net_bal ASC), ARRAY[]::TEXT[]),
        COALESCE(array_agg((-net_bal)::BIGINT ORDER BY net_bal ASC), ARRAY[]::BIGINT[])
    INTO debtor_ids, debtor_names, debtor_amounts
    FROM (
        SELECT member_id AS m_id, member_name AS m_name, net_balance AS net_bal
        FROM view_room_net_balances
        WHERE room_id = p_room_id AND net_balance < 0
    ) sub_debtors;

    -- Collect creditors ordered by credit descending (most positive balance first)
    SELECT 
        COALESCE(array_agg(m_id ORDER BY net_bal DESC), ARRAY[]::UUID[]),
        COALESCE(array_agg(m_name ORDER BY net_bal DESC), ARRAY[]::TEXT[]),
        COALESCE(array_agg(net_bal::BIGINT ORDER BY net_bal DESC), ARRAY[]::BIGINT[])
    INTO creditor_ids, creditor_names, creditor_amounts
    FROM (
        SELECT member_id AS m_id, member_name AS m_name, net_balance AS net_bal
        FROM view_room_net_balances
        WHERE room_id = p_room_id AND net_balance > 0
    ) sub_creditors;

    d_count := array_length(debtor_ids, 1);
    c_count := array_length(creditor_ids, 1);

    IF d_count IS NULL OR c_count IS NULL THEN
        RETURN;
    END IF;

    WHILE d_idx <= d_count AND c_idx <= c_count LOOP
        IF debtor_amounts[d_idx] <= 0 THEN
            d_idx := d_idx + 1;
            CONTINUE;
        END IF;
        IF creditor_amounts[c_idx] <= 0 THEN
            c_idx := c_idx + 1;
            CONTINUE;
        END IF;

        v_settle := LEAST(debtor_amounts[d_idx], creditor_amounts[c_idx]);

        debtor_id := debtor_ids[d_idx];
        debtor_name := debtor_names[d_idx];
        creditor_id := creditor_ids[c_idx];
        creditor_name := creditor_names[c_idx];
        amount := v_settle;
        RETURN NEXT;

        debtor_amounts[d_idx] := debtor_amounts[d_idx] - v_settle;
        creditor_amounts[c_idx] := creditor_amounts[c_idx] - v_settle;

        IF debtor_amounts[d_idx] = 0 THEN
            d_idx := d_idx + 1;
        END IF;
        IF creditor_amounts[c_idx] = 0 THEN
            c_idx := c_idx + 1;
        END IF;
    END LOOP;

    RETURN;
END;
$$;

-- Grant permissions for PostgREST
GRANT SELECT ON view_room_net_balances TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_simplified_debts(UUID) TO anon, authenticated;

-- Reload schema cache
DO $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
