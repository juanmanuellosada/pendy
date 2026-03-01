-- Add selected_calendar_ids to calendar_integrations
-- Stores which Google Calendar IDs the user has selected to show
-- Defaults to ['primary'] (the user's main calendar)

ALTER TABLE calendar_integrations
  ADD COLUMN IF NOT EXISTS selected_calendar_ids TEXT[] NOT NULL DEFAULT ARRAY['primary']::TEXT[];
