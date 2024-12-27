UPDATE driver_info di
                SET 
                    podiums = COALESCE((
                        SELECT COUNT(*) 
                        FROM driver_session_stats dss
                        JOIN session_info si ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'R'
                        AND dss.finishing_position BETWEEN 1 AND 3
                    ), 0),

                    distance_covered = COALESCE((
                        SELECT SUM(dti.distance_covered)
                        FROM driver_track_info dti
                        WHERE dti.steam_id = di.steam_id
                    ), 0.0),

                    best_position = COALESCE((
                        SELECT MIN(dss.finishing_position)
                        FROM driver_session_stats dss
                        JOIN session_info si ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'R'
                    ), NULL),

                    total_wins = COALESCE((
                        SELECT COUNT(*)
                        FROM driver_session_stats dss
                        JOIN session_info si ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'R'
                        AND dss.finishing_position = 1
                    ), 0),

                    total_poles = COALESCE((
                        SELECT COUNT(*)
                        FROM driver_session_stats dss
                        JOIN session_info si ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'Q'
                        AND dss.finishing_position = 1
                    ), 0),

                    total_sessions = COALESCE((
                        SELECT COUNT(DISTINCT dss.session_id)
                        FROM driver_session_stats dss
                        WHERE dss.steam_id = di.steam_id
                    ), 0),

                    average_finish_position = COALESCE((
                        SELECT AVG(dss.finishing_position)
                        FROM driver_session_stats dss
                        JOIN session_info si ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'R'
                        AND dss.finishing_position IS NOT NULL
                    ), NULL),

                    total_off_tracks = COALESCE((
                        SELECT SUM(dss.total_off_tracks)
                        FROM driver_session_stats dss
                        WHERE dss.steam_id = di.steam_id
                    ), 0),

                    total_races = COALESCE((
                        SELECT COUNT(*)
                        FROM session_info si
                        JOIN driver_session_stats dss ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'R'
                    ), 0),

                    total_qualifying_sessions = COALESCE((
                        SELECT COUNT(*)
                        FROM session_info si
                        JOIN driver_session_stats dss ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'Q'
                    ), 0),

                    total_practice_sessions = COALESCE((
                        SELECT COUNT(*)
                        FROM session_info si
                        JOIN driver_session_stats dss ON dss.session_id = si.id
                        WHERE dss.steam_id = di.steam_id 
                        AND si.session_type = 'FP'
                    ), 0);