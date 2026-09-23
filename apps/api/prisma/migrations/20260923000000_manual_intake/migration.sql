BEGIN;
-- Additive, empty structures. No source or accounting backfill.
CREATE TABLE manual_intake_states (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE manual_estimate_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  effective_from DATE NOT NULL,
  calories INTEGER NOT NULL CHECK (calories BETWEEN 1 AND 100000),
  revision INTEGER NOT NULL CHECK (revision > 0),
  timezone TEXT NOT NULL CHECK (length(timezone) > 0),
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX manual_estimate_boundaries_user_id_effective_from_key
  ON manual_estimate_boundaries(user_id, effective_from);
CREATE TABLE manual_intake_overrides (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  local_date DATE NOT NULL,
  calories INTEGER NOT NULL CHECK (calories BETWEEN 0 AND 100000),
  revision INTEGER NOT NULL CHECK (revision > 0),
  timezone TEXT NOT NULL CHECK (length(timezone) > 0),
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, local_date)
);
COMMIT;
