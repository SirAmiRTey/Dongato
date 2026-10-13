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
