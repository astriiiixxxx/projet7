-- ═══════════════════════════════════════════════════════════════
-- YCYW — PoC tchat temps réel · structure des données (PostgreSQL 16)
-- Ce script est identique aux migrations exécutées automatiquement
-- au démarrage du backend (src/database/database.module.ts).
-- Exécution manuelle :
--   docker exec -i ycyw_postgres psql -U ycyw -d ycyw_chat < backend/database/schema.sql
-- ═══════════════════════════════════════════════════════════════

-- gen_random_uuid() est natif depuis PostgreSQL 13.

-- Une session de tchat entre un client et un agent du service client.
-- status : waiting (aucun agent) → active (agent assigné) → closed.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   VARCHAR(255) NOT NULL,          -- identifiant issu du login simplifié de la PoC
  agent_id    VARCHAR(255),                   -- NULL tant qu'aucun agent n'a rejoint
  status      VARCHAR(20)  NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'active', 'closed')),
  subject     VARCHAR(500),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Les messages d'une session, dans l'ordre d'envoi.
-- sender_role = 'system' pour les événements (« X a rejoint la session »).
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID         NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id    VARCHAR(255) NOT NULL,
  sender_role  VARCHAR(20)  NOT NULL CHECK (sender_role IN ('client', 'agent', 'system')),
  content      TEXT         NOT NULL,
  sent_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Rechargement de l'historique d'une session (tri chronologique).
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON chat_messages(session_id, sent_at ASC);

-- Retrouver les sessions d'un client.
CREATE INDEX IF NOT EXISTS idx_chat_sessions_client_id
  ON chat_sessions(client_id);

-- ── Données côté Redis (non relationnelles) ─────────────────────
-- session:{token}        → JSON {userId, email, role}, TTL 24 h (authentification PoC)
-- canal ycyw:chat:{id}   → Pub/Sub, payload {type, sessionId, message}
--
-- ── Écarts assumés avec le modèle cible (livrable 2, section 06) ─
-- • client_id / agent_id sont des VARCHAR : la PoC n'a pas de table users ;
--   la cible utilise des UUID en clé étrangère vers users(id).
-- • La cible ajoute reservation_id, closed_at, read_at et le rôle 'bot'.
