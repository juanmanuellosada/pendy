-- Migration 010: Update habits table and add habit_schedules
-- Replace start_time/end_time with duration_minutes + scheduled_time
-- Add habit_schedules for per-day overrides

ALTER TABLE habits DROP COLUMN IF EXISTS start_time;
ALTER TABLE habits DROP COLUMN IF EXISTS end_time;
ALTER TABLE habits DROP COLUMN IF EXISTS description;

ALTER TABLE habits ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 30
  CHECK (duration_minutes > 0 AND duration_minutes <= 480);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS scheduled_time TIME;

-- Per-day schedule overrides
CREATE TABLE IF NOT EXISTS habit_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, scheduled_date)
);

ALTER TABLE habit_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habit_schedules_select" ON habit_schedules
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "habit_schedules_insert" ON habit_schedules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "habit_schedules_update" ON habit_schedules
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "habit_schedules_delete" ON habit_schedules
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_habit_schedules_habit ON habit_schedules(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_schedules_user_date ON habit_schedules(user_id, scheduled_date);
