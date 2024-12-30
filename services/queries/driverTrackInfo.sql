INSERT INTO driver_track_info (
    steam_id,
    track_id,
    car_class,
    car_model_id,
    distance_covered,
    total_sessions,
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
    MAX(dss.car_model_id) AS car_model_id,
    SUM(dss.total_laps) * MAX(t.track_length) AS distance_covered,
    COUNT(DISTINCT dss.session_id) AS total_sessions,
    MIN(CASE WHEN si.session_type = 'Q' THEN dss.finishing_position END) AS best_q_position,
    MIN(CASE WHEN si.session_type = 'R' THEN dss.finishing_position END) AS best_r_position,
    AVG(CASE WHEN si.session_type = 'FP' THEN dss.average_valid_lap END) AS average_valid_fp,
    AVG(CASE WHEN si.session_type = 'Q' THEN dss.average_valid_lap END) AS average_valid_q,
    AVG(CASE WHEN si.session_type = 'R' THEN dss.average_valid_lap END) AS average_valid_r,
    AVG(CASE WHEN si.session_type = 'FP' THEN dss.average_lap END) AS average_fp,
    AVG(CASE WHEN si.session_type = 'Q' THEN dss.average_lap END) AS average_q,
    AVG(CASE WHEN si.session_type = 'R' THEN dss.average_lap END) AS average_r,
    MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_lap END) AS fastest_q_lap,
    MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_lap END) AS fastest_r_lap,
    (MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s1 END) +
     MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s2 END) +
     MIN(CASE WHEN si.session_type = 'Q' THEN dss.fastest_possible_s3 END)) AS fastest_possible_q,
    (MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s1 END) +
     MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s2 END) +
     MIN(CASE WHEN si.session_type = 'R' THEN dss.fastest_possible_s3 END)) AS fastest_possible_r,
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
     )) AS fastest_possible_overall,
    SUM(dss.total_off_tracks) AS total_off_tracks,
    SUM(dss.total_laps) AS total_laps,
    MIN(CASE WHEN si.session_type = 'Q' THEN dss.class_position END) AS best_class_q_position,
    MIN(CASE WHEN si.session_type = 'R' THEN dss.class_position END) AS best_class_r_position,
    MIN(CASE WHEN si.session_type = 'Q' THEN dss.category_position END) AS best_category_q_position,
    MIN(CASE WHEN si.session_type = 'R' THEN dss.category_position END) AS best_category_r_position
FROM driver_session_stats dss
JOIN session_info si ON dss.session_id = si.id
JOIN track_info t ON si.track_id = t.track_id
LEFT JOIN car_info ci ON dss.car_model_id = ci.car_id
GROUP BY dss.steam_id, si.track_id
ON CONFLICT (steam_id, track_id, car_model_id)
DO UPDATE SET
    car_class = COALESCE(EXCLUDED.car_class, driver_track_info.car_class),
    distance_covered = COALESCE(EXCLUDED.distance_covered, driver_track_info.distance_covered),
    total_sessions = COALESCE(EXCLUDED.total_sessions, driver_track_info.total_sessions),
    best_q_position = COALESCE(LEAST(driver_track_info.best_q_position, EXCLUDED.best_q_position), driver_track_info.best_q_position),
    best_r_position = COALESCE(LEAST(driver_track_info.best_r_position, EXCLUDED.best_r_position), driver_track_info.best_r_position),
    best_class_q_position = COALESCE(LEAST(driver_track_info.best_class_q_position, EXCLUDED.best_class_q_position), driver_track_info.best_class_q_position),
    best_class_r_position = COALESCE(LEAST(driver_track_info.best_class_r_position, EXCLUDED.best_class_r_position), driver_track_info.best_class_r_position),
    best_category_q_position = COALESCE(LEAST(driver_track_info.best_category_q_position, EXCLUDED.best_category_q_position), driver_track_info.best_category_q_position),
    best_category_r_position = COALESCE(LEAST(driver_track_info.best_category_r_position, EXCLUDED.best_category_r_position), driver_track_info.best_category_r_position),
    average_valid_fp = COALESCE(EXCLUDED.average_valid_fp, driver_track_info.average_valid_fp),
    average_valid_q = COALESCE(EXCLUDED.average_valid_q, driver_track_info.average_valid_q),
    average_valid_r = COALESCE(EXCLUDED.average_valid_r, driver_track_info.average_valid_r),
    average_fp = COALESCE(EXCLUDED.average_fp, driver_track_info.average_fp),
    average_q = COALESCE(EXCLUDED.average_q, driver_track_info.average_q),
    average_r = COALESCE(EXCLUDED.average_r, driver_track_info.average_r),
    fastest_q_lap = COALESCE(EXCLUDED.fastest_q_lap, driver_track_info.fastest_q_lap),
    fastest_r_lap = COALESCE(EXCLUDED.fastest_r_lap, driver_track_info.fastest_r_lap),
    fastest_possible_q = COALESCE(EXCLUDED.fastest_possible_q, driver_track_info.fastest_possible_q),
    fastest_possible_r = COALESCE(EXCLUDED.fastest_possible_r, driver_track_info.fastest_possible_r),
    fastest_possible_overall = COALESCE(EXCLUDED.fastest_possible_overall, driver_track_info.fastest_possible_overall),
    total_off_tracks = COALESCE(EXCLUDED.total_off_tracks, driver_track_info.total_off_tracks),
    total_laps = COALESCE(EXCLUDED.total_laps, driver_track_info.total_laps)
