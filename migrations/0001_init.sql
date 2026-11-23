CREATE TABLE cards (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  body        TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 1000),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  position    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX cards_status_position ON cards (status, position);
CREATE INDEX cards_status_archived_at ON cards (status, archived_at);
