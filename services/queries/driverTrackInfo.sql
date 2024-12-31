INSERT INTO driver_track_info (
    steam_id,
    track_id,
    car_class,
    car_model_id,
    distance_covered,
    total_sessions,
    r_sessions,
    q_sessions,
    fp_sessions,
    total_valid_laps,
    best_q_position,
    best_r_position,
    average_valid_fp,
    average_valid_q,
    average_valid_r,
    average_fp,
    average_q,
    average_r,
    fastest_q_lap,
    fastest_r_lap,
    fastest_possible_q,
    fastest_possible_r,
    fastest_possible_overall,
    total_off_tracks,
    total_laps,
    best_class_q_position,
    best_class_r_position,
    best_category_q_position,
    best_category_r_position
)
SELECT 
    dss.steam_id,
    si.track_id,
    COALESCE(MAX(ci.car_class), 'UNKNOWN') AS car_class,
    COALESCE(MAX(dss.car_model_id), 0) AS car_model_id,
    SUM(dss.total_laps) * COALESCE(MAX(t.track_length), 0.0) AS distance_covered,
    COUNT(DISTINCT dss.session_id) AS total_sessions,
    COUNT(DISTINCT CASE WHEN si.session_type = 'R' THEN dss.session_id END) AS r_sessions,
    COUNT(DISTINCT CASE WHEN si.session_type = 'Q' THEN dss.session_id END) AS q_sessions,
    COUNT(DISTINCT CASE WHEN si.session_type = 'FP' THEN dss.session_id END) AS fp_sessions,
    COALESCE(SUM(dss.total_valid_laps), 0) AS total_valid_laps,
    COALESCE(MIN(CASE WHEN si.session_type = 'Q' THEN dss.finishing_position END), null) AS best_q_position,
    COALESCE(MIN(CASE WHEN si.session_type = 'R' THEN dss.finishing_position END), null) AS best_r_position,
    COALESCE(AVG(CASE WHEN si.session_type = 'FP' THEN dss.average_valid_lap END), null) AS average_valid_fp,
    COALESCE(AVG(CASE WHEN si.session_type = 'Q' THEN dss.average_valid_lap END), null) AS average_valid_q,
    COALESCE(AVG(CASE WHEN si.session_type = 'R' THEN dss.average_valid_lap END), null) AS average_valid_r,
    COALESCE(AVG(CASE WHEN si.session_type = 'FP' THEN dss.average_lap END), null) AS average_fp,
    COALESCE(AVG(CASE WHEN si.session_type = 'Q' THEN dss.average_lap END), null) AS average_q,
    COALESCE(AVG(CASE WHEN si.session_type = 'R' THEN dss.average_lap END), null) AS average_r,
    COALESCE(MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_lap END), null) AS fastest_q_lap,
    COALESCE(MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_lap END), null) AS fastest_r_lap,
    COALESCE(
        (MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s1 END) +
         MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s2 END) +
         MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s3 END)), 
    null) AS fastest_possible_q,
    COALESCE(
        (MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s1 END) +
         MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s2 END) +
         MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s3 END)), 
    null) AS fastest_possible_r,
    COALESCE(
        (LEAST(
            MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s1 END),
            MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s1 END)
        ) +
        LEAST(
            MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s2 END),
            MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s2 END)
        ) +
        LEAST(
            MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s3 END),
            MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s3 END)
        )), 
    null) AS fastest_possible_overall,
    COALESCE(SUM(dss.total_off_tracks), 0) AS total_off_tracks,
    COALESCE(SUM(dss.total_laps), 0) AS total_laps,
    COALESCE(MIN(CASE WHEN si.session_type = 'Q' THEN dss.class_position END), null) AS best_class_q_position,
    COALESCE(MIN(CASE WHEN si.session_type = 'R' THEN dss.class_position END), null) AS best_class_r_position,
    COALESCE(MIN(CASE WHEN si.session_type = 'Q' THEN dss.category_position END), null) AS best_category_q_position,
    COALESCE(MIN(CASE WHEN si.session_type = 'R' THEN dss.category_position END), null) AS best_category_r_position
FROM driver_session_stats dss
JOIN session_info si ON dss.session_id = si.id
JOIN track_info t ON si.track_id = t.track_id
LEFT JOIN car_info ci ON dss.car_model_id = ci.car_id
GROUP BY dss.steam_id, si.track_id, dss.car_model_id
ON CONFLICT (steam_id, track_id, car_model_id)
DO UPDATE SET
    car_class = EXCLUDED.car_class,
    distance_covered = EXCLUDED.distance_covered,
    total_sessions = EXCLUDED.total_sessions,
    r_sessions = EXCLUDED.r_sessions,
    q_sessions = EXCLUDED.q_sessions,
    fp_sessions = EXCLUDED.fp_sessions,
    total_valid_laps = EXCLUDED.total_valid_laps,
    best_q_position = LEAST(driver_track_info.best_q_position, EXCLUDED.best_q_position),
    best_r_position = LEAST(driver_track_info.best_r_position, EXCLUDED.best_r_position),
    best_class_q_position = LEAST(driver_track_info.best_class_q_position, EXCLUDED.best_class_q_position),
    best_class_r_position = LEAST(driver_track_info.best_class_r_position, EXCLUDED.best_class_r_position),
    best_category_q_position = LEAST(driver_track_info.best_category_q_position, EXCLUDED.best_category_q_position),
    best_category_r_position = LEAST(driver_track_info.best_category_r_position, EXCLUDED.best_category_r_position),
    average_valid_fp = EXCLUDED.average_valid_fp,
    average_valid_q = EXCLUDED.average_valid_q,
    average_valid_r = EXCLUDED.average_valid_r,
    average_fp = EXCLUDED.average_fp,
    average_q = EXCLUDED.average_q,
    average_r = EXCLUDED.average_r,
    fastest_q_lap = LEAST(driver_track_info.fastest_q_lap, EXCLUDED.fastest_q_lap),
    fastest_r_lap = LEAST(driver_track_info.fastest_r_lap, EXCLUDED.fastest_r_lap),
    total_off_tracks = EXCLUDED.total_off_tracks,
    total_laps = EXCLUDED.total_laps;
