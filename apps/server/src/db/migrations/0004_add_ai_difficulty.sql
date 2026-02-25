-- Add AI difficulty level to players table
ALTER TABLE players ADD COLUMN ai_difficulty VARCHAR(10) DEFAULT 'medium';
