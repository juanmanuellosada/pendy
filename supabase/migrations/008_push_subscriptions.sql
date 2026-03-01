-- Push subscriptions for Web Push notifications
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_subscriptions_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_delete" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Index for fast lookup by user
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Cron job: call process-reminders every minute
-- Requires pg_cron + pg_net extensions (enabled in Supabase by default)
-- Run this after deploying the edge function and setting CRON_SECRET:
--
-- SELECT cron.schedule(
--   'process-reminders',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/process-reminders',
--     headers := json_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.cron_secret')
--     )::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
