-- Add AI player support
-- AI players don't need a secret_id (they don't authenticate)

-- Add is_ai column to players table
ALTER TABLE players ADD COLUMN is_ai BOOLEAN NOT NULL DEFAULT false;

-- Make secret_id nullable for AI players
ALTER TABLE players ALTER COLUMN secret_id DROP NOT NULL;

-- Update unique constraint: secret_id must only be unique among human players
DROP INDEX IF EXISTS idx_players_secret_id;
CREATE UNIQUE INDEX idx_players_secret_id_unique ON players(secret_id) WHERE is_ai = false AND secret_id IS NOT NULL;
