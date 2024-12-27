INSERT INTO driver_car_track_info (
                steam_id,
                track_id,
                car_model,
                car_class,
                distance_covered,
                total_sessions,
                best_q_position,
                best_r_position,
                total_laps,
                created_at
            )
            SELECT 
                dss.steam_id,
                si.track_id,
                ci.car_model,
                ci.car_class,
                SUM(dss.total_laps) * t.track_length AS distance_covered,
                COUNT(DISTINCT dss.session_id || '-' || dss.car_id) AS total_sessions, -- Ensure unique session-car combo
                MIN(CASE WHEN si.session_type = 'Q' THEN dss.finishing_position END) AS best_q_position,
                MIN(CASE WHEN si.session_type = 'R' THEN dss.finishing_position END) AS best_r_position,
                SUM(dss.total_laps) AS total_laps,
                NOW()
            FROM driver_session_stats dss
            JOIN session_info si ON dss.session_id = si.id
            JOIN track_info t ON si.track_id = t.track_id
            JOIN car_info ci ON dss.car_model_id = ci.car_id
            WHERE dss.steam_id IS NOT NULL 
            AND dss.car_id IS NOT NULL
            GROUP BY dss.steam_id, si.track_id, ci.car_model, ci.car_class, t.track_length
            ON CONFLICT (steam_id, track_id, car_model)
            DO UPDATE SET
                distance_covered = EXCLUDED.distance_covered,
                total_sessions = EXCLUDED.total_sessions,
                best_q_position = LEAST(driver_car_track_info.best_q_position, EXCLUDED.best_q_position),
                best_r_position = LEAST(driver_car_track_info.best_r_position, EXCLUDED.best_r_position),
                total_laps = EXCLUDED.total_laps,
                car_class = EXCLUDED.car_class,
                created_at = NOW();