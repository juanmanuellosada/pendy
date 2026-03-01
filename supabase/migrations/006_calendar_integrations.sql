-- Calendar integrations table
-- Stores OAuth tokens for Google Calendar and Microsoft Outlook (read-only)
CREATE TABLE calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Row Level Security
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_integrations_select"
  ON calendar_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "calendar_integrations_insert"
  ON calendar_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "calendar_integrations_update"
  ON calendar_integrations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "calendar_integrations_delete"
  ON calendar_integrations FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_calendar_integrations_modtime
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Index for fast lookups by user
CREATE INDEX idx_calendar_integrations_user_id
  ON calendar_integrations(user_id);
