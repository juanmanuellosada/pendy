-- Add deadline column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline DATE;
