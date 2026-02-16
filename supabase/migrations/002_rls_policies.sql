-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (id = auth.uid());

-- Projects policies
CREATE POLICY "projects_select" ON projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (user_id = auth.uid());

-- Sections policies
CREATE POLICY "sections_select" ON sections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sections_insert" ON sections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sections_update" ON sections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "sections_delete" ON sections FOR DELETE USING (user_id = auth.uid());

-- Tasks policies
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (user_id = auth.uid());

-- Labels policies
CREATE POLICY "labels_select" ON labels FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "labels_insert" ON labels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "labels_update" ON labels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "labels_delete" ON labels FOR DELETE USING (user_id = auth.uid());

-- Task labels policies (join through task ownership)
CREATE POLICY "task_labels_select" ON task_labels FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY "task_labels_insert" ON task_labels FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY "task_labels_delete" ON task_labels FOR DELETE
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.user_id = auth.uid()));

-- Comments policies
CREATE POLICY "comments_select" ON comments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (user_id = auth.uid());

-- Attachments policies
CREATE POLICY "attachments_select" ON attachments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attachments_insert" ON attachments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "attachments_update" ON attachments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "attachments_delete" ON attachments FOR DELETE USING (user_id = auth.uid());

-- Reminders policies
CREATE POLICY "reminders_select" ON reminders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "reminders_insert" ON reminders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reminders_update" ON reminders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reminders_delete" ON reminders FOR DELETE USING (user_id = auth.uid());

-- Filters policies
CREATE POLICY "filters_select" ON filters FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "filters_insert" ON filters FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "filters_update" ON filters FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "filters_delete" ON filters FOR DELETE USING (user_id = auth.uid());

-- Activity log policies
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (user_id = auth.uid());
