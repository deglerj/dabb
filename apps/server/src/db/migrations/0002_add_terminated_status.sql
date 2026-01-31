-- Add 'terminated' status to sessions table
-- This migration is idempotent: checks if constraint already includes 'terminated'
--
-- Background: The sessions table status constraint originally only allowed
-- 'waiting', 'active', and 'finished'. The 'terminated' status was added
-- for games that end when a player leaves (as opposed to finishing normally).

DO $$
BEGIN
  -- Only alter if 'terminated' is not already in the constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_status_check'
    AND pg_get_constraintdef(oid) LIKE '%terminated%'
  ) THEN
    ALTER TABLE sessions DROP CONSTRAINT sessions_status_check;
    ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
      CHECK (status IN ('waiting', 'active', 'finished', 'terminated'));
  END IF;
END $$;
