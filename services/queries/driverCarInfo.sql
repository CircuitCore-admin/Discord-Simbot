WITH aggregated_driver_data AS (
    SELECT 
        dts.steam_id,
        dts.car_model_id,
        COALESCE(SUM(dts.total_laps), 0) AS total_laps,
        COALESCE(SUM(dts.total_valid_laps), 0) AS total_valid_laps,
        COALESCE(SUM(dts.total_sessions), 0) AS total_sessions,
        COALESCE(SUM(dts.distance_covered), 0.0) AS distance_covered,
        COALESCE(MIN(dts.best_q_position), NULL) AS best_q_position,
        COALESCE(MIN(dts.best_r_position), NULL) AS best_r_position,
        COALESCE(MIN(dts.best_class_q_position), NULL) AS best_class_q,
        COALESCE(MIN(dts.best_class_r_position), NULL) AS best_class_r,
        COALESCE(MIN(dts.best_category_q_position), NULL) AS best_category_q,
        COALESCE(MIN(dts.best_category_r_position), NULL) AS best_category_r,
        COALESCE(SUM(dts.total_off_tracks), 0) AS total_off_tracks,
        COALESCE(SUM(dts.fp_sessions), 0) AS fp_sessions,
        COALESCE(SUM(dts.q_sessions), 0) AS q_sessions,
        COALESCE(SUM(dts.r_sessions), 0) AS r_sessions
    FROM driver_track_info dts
    GROUP BY dts.steam_id, dts.car_model_id
)

INSERT INTO driver_car_stats (
    steam_id,
    car_model_id,
    car_model,
    car_class,
    total_laps,
    total_valid_laps,
    total_sessions,
    fp_sessions,
    q_sessions,
    r_sessions,
    distance_covered,
    best_q_position,
    best_r_position,
    best_class_q,
    best_class_r,
    best_category_q,
    best_category_r,
    total_off_tracks
)
SELECT 
    agg.steam_id,
    agg.car_model_id,
    COALESCE(ci.car_model, 'UNKNOWN') AS car_model,
    COALESCE(ci.car_class, 'UNKNOWN') AS car_class,
    agg.total_laps,
    agg.total_valid_laps,
    agg.total_sessions,
    agg.fp_sessions,
    agg.q_sessions,
    agg.r_sessions,
    agg.distance_covered,
    agg.best_q_position,
    agg.best_r_position,
    agg.best_class_q,
    agg.best_class_r,
    agg.best_category_q,
    agg.best_category_r,
    agg.total_off_tracks
FROM aggregated_driver_data agg
JOIN car_info ci ON agg.car_model_id = ci.car_id
ON CONFLICT (steam_id, car_model_id)
DO UPDATE SET
    car_model = EXCLUDED.car_model,
    car_class = EXCLUDED.car_class,
    total_laps = driver_car_stats.total_laps + EXCLUDED.total_laps,
    total_valid_laps = driver_car_stats.total_valid_laps + EXCLUDED.total_valid_laps,
    total_sessions = driver_car_stats.total_sessions + EXCLUDED.total_sessions,
    fp_sessions = driver_car_stats.fp_sessions + EXCLUDED.fp_sessions,
    q_sessions = driver_car_stats.q_sessions + EXCLUDED.q_sessions,
    r_sessions = driver_car_stats.r_sessions + EXCLUDED.r_sessions,
    distance_covered = driver_car_stats.distance_covered + EXCLUDED.distance_covered,
    best_q_position = LEAST(driver_car_stats.best_q_position, EXCLUDED.best_q_position),
    best_r_position = LEAST(driver_car_stats.best_r_position, EXCLUDED.best_r_position),
    best_class_q = LEAST(driver_car_stats.best_class_q, EXCLUDED.best_class_q),
    best_class_r = LEAST(driver_car_stats.best_class_r, EXCLUDED.best_class_r),
    best_category_q = LEAST(driver_car_stats.best_category_q, EXCLUDED.best_category_q),
    best_category_r = LEAST(driver_car_stats.best_category_r, EXCLUDED.best_category_r),
    total_off_tracks = driver_car_stats.total_off_tracks + EXCLUDED.total_off_tracks;
