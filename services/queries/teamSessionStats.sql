INSERT INTO team_session_stats (
                session_id,
                car_model_id, -- Updated to use car_model_id
                total_drivers,
                team_name,
                total_laps,
                total_race_time,
                finishing_position,
                average_lap,
                fastest_lap,
                total_off_tracks,
                created_at
            )
            SELECT 
                dss.session_id,
                dss.car_model_id, -- Ensure car_model_id is used
                COUNT(DISTINCT dss.steam_id) AS total_drivers,
                COALESCE(si.session_name, 'Unknown Team') AS team_name,
                SUM(dss.total_laps) AS total_laps,
                SUM(dss.total_race_time) AS total_race_time,
                MIN(dss.finishing_position) AS finishing_position,
                AVG(dss.average_lap) AS average_lap,
                MIN(dss.fastest_lap) AS fastest_lap,
                SUM(dss.total_off_tracks) AS total_off_tracks,
                NOW()
            FROM driver_session_stats dss
            JOIN session_info si ON dss.session_id = si.id
            WHERE si.id = $1 AND si.is_team_event = TRUE
            GROUP BY dss.session_id, dss.car_model_id, si.session_name
            ON CONFLICT (session_id, car_model_id) -- Updated to use car_model_id
            DO UPDATE SET
                total_drivers = EXCLUDED.total_drivers,
                team_name = EXCLUDED.team_name,
                total_laps = EXCLUDED.total_laps,
                total_race_time = EXCLUDED.total_race_time,
                finishing_position = LEAST(team_session_stats.finishing_position, EXCLUDED.finishing_position),
                average_lap = EXCLUDED.average_lap,
                fastest_lap = LEAST(team_session_stats.fastest_lap, EXCLUDED.fastest_lap),
                total_off_tracks = EXCLUDED.total_off_tracks,
                created_at = NOW();