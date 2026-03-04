-- Enable Supabase Realtime on all core tables for live sync across devices/tabs
ALTER PUBLICATION supabase_realtime ADD TABLE tasks, projects, sections, labels, task_labels, comments, reminders, filters;
