CREATE TABLE driver_car_track_info (
    steam_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_class VARCHAR(50) NOT NULL,
    distance_covered DOUBLE PRECISION DEFAULT 0.0,
    total_sessions INTEGER DEFAULT 0,
    best_q_position INTEGER,
    best_r_position INTEGER,
    total_laps INTEGER DEFAULT 0,
    valid_laps INTEGER DEFAULT 0,
    PRIMARY KEY (steam_id, track_id, car_model),
    UNIQUE (steam_id, track_id, car_model),
    FOREIGN KEY (steam_id) REFERENCES driver_info(steam_id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES track_info(track_id) ON DELETE CASCADE
);
