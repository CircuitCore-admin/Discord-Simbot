INSERT INTO team_driver_stats (
                team_session_id,
                steam_id,
                car_id,
                total_laps,
                total_race_time,
                fastest_lap,
                total_off_tracks,
                created_at
            )
            SELECT 
                tss.id AS team_session_id,
                dss.steam_id,
                dss.car_id,
                SUM(dss.total_laps) AS total_laps,
                SUM(dss.total_race_time) AS total_race_time,
                MIN(dss.fastest_lap) AS fastest_lap,
                SUM(dss.total_off_tracks) AS total_off_tracks,
                NOW() AS created_at
            FROM driver_session_stats dss
            JOIN session_info si ON dss.session_id = si.id
            JOIN team_session_stats tss ON si.id = tss.session_id AND dss.car_id = tss.car_id
            WHERE si.is_team_event = TRUE
            GROUP BY tss.id, dss.steam_id, dss.car_id
            ON CONFLICT (team_session_id, steam_id, car_id)
            DO UPDATE SET
                total_laps = EXCLUDED.total_laps,
                total_race_time = EXCLUDED.total_race_time,
                fastest_lap = LEAST(team_driver_stats.fastest_lap, EXCLUDED.fastest_lap),
                total_off_tracks = EXCLUDED.total_off_tracks,
                created_at = NOW();