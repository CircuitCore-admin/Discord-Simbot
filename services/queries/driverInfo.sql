WITH stats AS (
    SELECT 
        dss.steam_id,
        COUNT(*) FILTER (WHERE si.session_type = 'R' AND dss.finishing_position BETWEEN 1 AND 3) AS podiums,
        COUNT(*) FILTER (WHERE si.session_type = 'R' AND dss.finishing_position = 1) AS total_wins,
        COUNT(*) FILTER (WHERE si.session_type = 'Q' AND dss.finishing_position = 1) AS total_poles,
        COUNT(DISTINCT dss.session_id) AS total_sessions,
        AVG(dss.finishing_position) FILTER (WHERE si.session_type = 'R' AND dss.finishing_position IS NOT NULL) AS average_finish_position,
        SUM(dss.total_off_tracks) AS total_off_tracks,
        SUM(dss.total_laps) AS total_laps_driven,
        MIN(dss.finishing_position) FILTER (WHERE si.session_type = 'R') AS best_position,
        MIN(dss.finishing_position) FILTER (WHERE si.session_type = 'Q') AS best_qualifying_position,
        COUNT(*) FILTER (WHERE si.session_type = 'R') AS total_races,
        COUNT(*) FILTER (WHERE si.session_type = 'Q') AS total_qualifying_sessions,
        COUNT(*) FILTER (WHERE si.session_type = 'FP') AS total_practice_sessions
    FROM driver_session_stats dss
    LEFT JOIN session_info si ON dss.session_id = si.id
    GROUP BY dss.steam_id
),

track_info AS (
    SELECT 
        steam_id,
        SUM(distance_covered) AS total_distance_covered
    FROM driver_track_info
    GROUP BY steam_id
)

UPDATE driver_info di
SET 
    podiums = COALESCE(stats.podiums, 0),
    distance_covered = COALESCE(track_info.total_distance_covered, 0.0),
    best_position = COALESCE(stats.best_position, NULL),
    best_qualifying_position = COALESCE(stats.best_qualifying_position, NULL),
    total_wins = COALESCE(stats.total_wins, 0),
    total_poles = COALESCE(stats.total_poles, 0),
    total_sessions = COALESCE(stats.total_sessions, 0),
    average_finish_position = COALESCE(stats.average_finish_position, NULL),
    total_off_tracks = COALESCE(stats.total_off_tracks, 0),
    total_races = COALESCE(stats.total_races, 0),
    total_qualifying_sessions = COALESCE(stats.total_qualifying_sessions, 0),
    total_practice_sessions = COALESCE(stats.total_practice_sessions, 0),
    total_laps_driven = COALESCE(stats.total_laps_driven, 0)
FROM stats
LEFT JOIN track_info ON stats.steam_id = track_info.steam_id
WHERE di.steam_id = stats.steam_id;
