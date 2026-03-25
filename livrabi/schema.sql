-- ═══════════════════════════════════════════════════════
--  LIVRABI — Schéma de base de données PostgreSQL
-- ═══════════════════════════════════════════════════════

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── UTILISATEURS ──────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  pseudo        VARCHAR(50)  UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  lang          VARCHAR(5)   NOT NULL DEFAULT 'fr',
  role          VARCHAR(20)  NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  is_verified   BOOLEAN      NOT NULL DEFAULT false,
  verify_token  TEXT,
  reset_token   TEXT,
  reset_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── HISTOIRES ─────────────────────────────────────────
CREATE TABLE stories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(200) NOT NULL,
  genre         VARCHAR(50)  NOT NULL,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active', -- 'active' | 'closed' | 'deleted'
  likes_count   INTEGER      NOT NULL DEFAULT 0,
  followers_count INTEGER    NOT NULL DEFAULT 0,
  contrib_count INTEGER      NOT NULL DEFAULT 1, -- compte le premier paragraphe
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── PARAGRAPHES ───────────────────────────────────────
CREATE TABLE paragraphs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id      UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  word_count    INTEGER NOT NULL,
  image_type    VARCHAR(20)  DEFAULT NULL, -- 'ai' | 'upload' | NULL
  image_url     TEXT         DEFAULT NULL,
  is_first      BOOLEAN      NOT NULL DEFAULT false,
  is_branch     BOOLEAN      NOT NULL DEFAULT false,
  branch_from   UUID         REFERENCES paragraphs(id) ON DELETE SET NULL,
  position      INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── LIKES ─────────────────────────────────────────────
CREATE TABLE likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id)
);

-- ── ABONNEMENTS (suivre une histoire) ─────────────────
CREATE TABLE follows (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id)
);

-- ── COOLDOWNS (1 contrib. / 60 min par histoire) ──────
CREATE TABLE contribution_cooldowns (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  last_contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id)
);

-- ── NOTIFICATIONS ─────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL, -- 'new_paragraph' | 'new_branch' | 'like'
  story_id   UUID REFERENCES stories(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEX ─────────────────────────────────────────────
CREATE INDEX idx_stories_author    ON stories(author_id);
CREATE INDEX idx_stories_status    ON stories(status);
CREATE INDEX idx_stories_likes     ON stories(likes_count DESC);
CREATE INDEX idx_paragraphs_story  ON paragraphs(story_id);
CREATE INDEX idx_paragraphs_author ON paragraphs(author_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ── FONCTIONS ─────────────────────────────────────────
-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stories_updated BEFORE UPDATE ON stories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
