-- Habits table
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#283B56',
  icon TEXT,
  start_time TIME,
  end_time TIME,
  recurrence_type TEXT NOT NULL DEFAULT 'daily'
    CHECK (recurrence_type IN ('daily', 'times_per_week', 'specific_days')),
  times_per_week INT CHECK (times_per_week BETWEEN 1 AND 7),
  specific_days INT[] DEFAULT '{}',  -- 0=Dom, 1=Lun ... 6=Sab
  is_active BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit completions table
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, completed_date)
);

-- RLS: habits
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habits_select" ON habits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "habits_insert" ON habits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "habits_update" ON habits
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "habits_delete" ON habits
  FOR DELETE USING (user_id = auth.uid());

-- RLS: habit_completions
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habit_completions_select" ON habit_completions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "habit_completions_insert" ON habit_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "habit_completions_update" ON habit_completions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "habit_completions_delete" ON habit_completions
  FOR DELETE USING (user_id = auth.uid());

-- Trigger: updated_at on habits
CREATE TRIGGER update_habits_modtime
  BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Indexes
CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habit_completions_habit_date ON habit_completions(habit_id, completed_date);
CREATE INDEX idx_habit_completions_user_date ON habit_completions(user_id, completed_date);
