CREATE TABLE track_info (
    track_id VARCHAR(50) NOT NULL,
    track_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    track_length DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id)
);
