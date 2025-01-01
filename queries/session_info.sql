CREATE TABLE session_info (
    id INTEGER NOT NULL DEFAULT nextval('session_info_id_seq'::regclass),
    track_id VARCHAR(50),
    session_type VARCHAR(2) CHECK (session_type IN ('FP', 'Q', 'R')),
    session_name VARCHAR(255) NOT NULL,
    results_name VARCHAR(255) NOT NULL,
    date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    is_team_event BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (track_id) REFERENCES track_info(track_id) ON DELETE CASCADE
);
