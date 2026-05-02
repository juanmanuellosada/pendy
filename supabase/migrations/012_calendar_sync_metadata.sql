-- Metadata de sincronización para calendar_integrations
-- Permite mostrar estado de sync en la UI y detectar desconexiones silenciosas.

ALTER TABLE calendar_integrations
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'ok'
    CHECK (sync_status IN ('ok', 'token_expired', 'error'));
