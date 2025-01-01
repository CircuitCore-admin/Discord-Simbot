CREATE TABLE driver_info (
    steam_id TEXT NOT NULL,
    discord_id BIGINT UNIQUE,
    username VARCHAR(255),
    real_name VARCHAR COLLATE pg_c_utf8,
    podiums INTEGER DEFAULT 0,
    distance_covered DOUBLE PRECISION DEFAULT 0.0,
    best_position INTEGER,
    total_wins INTEGER DEFAULT 0,
    total_poles INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    average_finish_position DOUBLE PRECISION,
    total_off_tracks INTEGER DEFAULT 0,
    total_races INTEGER DEFAULT 0,
    total_qualifying_sessions INTEGER DEFAULT 0,
    total_practice_sessions INTEGER DEFAULT 0,
    best_qualifying_position INTEGER,
    total_laps_driven INTEGER DEFAULT 0,
    PRIMARY KEY (steam_id)
);
CREATE INDEX idx_real_name_trgm ON driver_info USING gin (real_name gin_trgm_ops);
