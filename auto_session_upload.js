const fs = require('fs');
const path = require('path');
const db = require('./services/database');
const carModels = require('./data/carModels');

// Paths
const resultsPath = path.join(__dirname, 'results');
const processedPath = path.join(__dirname, 'processed');

// ✅ Import the car class helper
const { getCarClass, getCarModel } = require('./helpers/carClassHelper');

// ✅ Helper function to sanitize SteamID
function sanitizeSteamId(steamId) {
    return steamId ? steamId.replace(/\D/g, '') : null;
}

// ✅ Helper function to format lap time
const formatLapTime = ms => {
    if (ms === 'N/A' || ms == null) return 'N/A';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.round(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
};

// ✅ Detect session type based on file name
function detectSessionType(fileName) {
    if (fileName.includes('FP')) return 'FP';
    if (fileName.includes('Q')) return 'Q';
    if (fileName.includes('R')) return 'R';
    return null;
}

// ✅ Load JSON Data
const loadData = filePath => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        throw new Error(`❌ Failed to load JSON data from ${filePath}: ${error.message}`);
    }
};

// ✅ Ensure drivers exist in `driver_info`
async function ensureDriversExist(driverStats) {
    for (const driver of driverStats) {
        let steamId = sanitizeSteamId(driver.car?.drivers?.[0]?.playerId);
        const firstName = driver.car?.drivers?.[0]?.firstName || 'Unknown';
        const lastName = driver.car?.drivers?.[0]?.lastName || 'Driver';
        const realName = `${firstName} ${lastName}`.trim();

        if (!steamId) {
            console.warn(`❌ Missing SteamID for driver: ${realName}, skipping driver entry`);
            continue;
        }

        try {
            let driverResult = await db.query(
                `SELECT steam_id FROM driver_info WHERE steam_id = $1`,
                [steamId]
            );

            if (driverResult.rows.length === 0) {
                await db.query(
                    `INSERT INTO driver_info (steam_id, real_name) 
                     VALUES ($1, $2)`,
                    [steamId, realName]
                );
                console.log(`🆕 Added new driver: ${steamId}`);
            } else {
                console.log(`🔗 Found driver: ${steamId}`);
            }
        } catch (err) {
            console.error(`❌ Failed to ensure driver exists for ${realName}:`, err.message);
        }
    }
}

// ✅ Refresh driver_track_info
async function refreshDriverTrackInfo() {
    try {
        await db.query(`
            INSERT INTO driver_track_info (
                steam_id,
                track_id,
                car_class,
                car_id,
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
                created_at
            )
            SELECT 
                dss.steam_id,
                si.track_id,
                MAX(ci.car_class) AS car_class,
                MAX(dss.car_id) AS car_id,
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
                NOW()
            FROM driver_session_stats dss
            JOIN session_info si ON dss.session_id = si.id
            JOIN track_info t ON si.track_id = t.track_id
            JOIN car_info ci ON dss.car_id = ci.car_id
            GROUP BY dss.steam_id, si.track_id
            ON CONFLICT (steam_id, track_id)
            DO UPDATE SET
                car_class = EXCLUDED.car_class,
                car_id = EXCLUDED.car_id,
                distance_covered = EXCLUDED.distance_covered,
                total_sessions = EXCLUDED.total_sessions,
                best_q_position = LEAST(driver_track_info.best_q_position, EXCLUDED.best_q_position),
                best_r_position = LEAST(driver_track_info.best_r_position, EXCLUDED.best_r_position),
                average_valid_fp = EXCLUDED.average_valid_fp,
                average_valid_q = EXCLUDED.average_valid_q,
                average_valid_r = EXCLUDED.average_valid_r,
                average_fp = EXCLUDED.average_fp,
                average_q = EXCLUDED.average_q,
                average_r = EXCLUDED.average_r,
                fastest_q_lap = EXCLUDED.fastest_q_lap,
                fastest_r_lap = EXCLUDED.fastest_r_lap,
                fastest_possible_q = EXCLUDED.fastest_possible_q,
                fastest_possible_r = EXCLUDED.fastest_possible_r,
                fastest_possible_overall = EXCLUDED.fastest_possible_overall,
                total_off_tracks = EXCLUDED.total_off_tracks,
                total_laps = EXCLUDED.total_laps,
                created_at = NOW();

        `);

        console.log('🔄 Driver track info refreshed successfully.');
    } catch (error) {
        console.error('❌ Failed to refresh driver track info:', error.message);
    }
}

// ✅ Update driver_info table
async function refreshDriverInfo() {
    try {
        await db.query(`
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

        `);
        console.log('🔄 Driver info refreshed successfully.');
    } catch (error) {
        console.error('❌ Failed to refresh driver info:', error.message);
    }
}

// -- ✅ Refresh Driver Car Track Info
async function refreshDriverCarTrackInfo() {
    try {
        await db.query(`
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
            JOIN car_info ci ON dss.car_id = ci.car_id
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


        `);

        console.log('🔄 Driver Car Track Info refreshed successfully.');
    } catch (error) {
        console.error('❌ Failed to refresh driver car track info:', error.message);
    }
}



// ✅ Validator for Invalid Sector and Lap Times
function validateTime(time, invalidValues) {
    return invalidValues.includes(time) ? null : time;
}

// ✅ Extract driver-specific stats
function extractDriverStats(driver, lapsData, raceLeaderboard, sessionType) {
    const driverLaps = lapsData.filter(lap => lap.carId === driver.car.carId);
    const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);
    const invalidLaps = driverLaps.length - validLaps.length;

    // ✅ Pull best sector times directly from timing.bestSplits and validate them
    const bestSplits = driver.timing?.bestSplits || [null, null, null];
    const fastest_s1 = validateTime(bestSplits[0], [2147483647]);
    const fastest_s2 = validateTime(bestSplits[1], [2147483647]);
    const fastest_s3 = validateTime(bestSplits[2], [2147483647]);

    // ✅ Validate fastest_possible_lap
    let fastestPossibleLap = bestSplits.every(split => split !== null)
        ? bestSplits.reduce((a, b) => a + b, 0)
        : null;

    fastestPossibleLap = validateTime(fastestPossibleLap, [6442450941]);

    // ✅ Leader Delta Handling
    let leaderDelta = null;

    const driverFastestLap = validateTime(driver.timing?.bestLap || null, [2147483647]);
    const leaderFastestLap = validateTime(raceLeaderboard[0]?.timing?.bestLap || null, [2147483647]);

    const driverTotalTime = driver.timing?.totalTime || 0;
    const leaderTotalTime = raceLeaderboard[0]?.timing?.totalTime || 0;
    const driverLapCount = driver.timing?.lapCount || 0;
    const leaderLapCount = raceLeaderboard[0]?.timing?.lapCount || 0;

    // ✅ Check if the driver has valid laps or completed laps
    const hasValidLaps = validLaps.length > 0;
    const hasCompletedLaps = driverLapCount > 0;

    if (!hasCompletedLaps) {
        leaderDelta = null;
    } else if (sessionType === 'FP' || sessionType === 'Q') {
        if (driverFastestLap && leaderFastestLap) {
            const timeDelta = driverFastestLap - leaderFastestLap;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    } else if (sessionType === 'R') {
        if (driverLapCount < leaderLapCount) {
            const lapDifference = leaderLapCount - driverLapCount;
            leaderDelta = `+${lapDifference} Lap${lapDifference > 1 ? 's' : ''}`;
        } else if (driverLapCount === leaderLapCount && leaderTotalTime > 0 && driverTotalTime > 0) {
            const timeDelta = driverTotalTime - leaderTotalTime;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    }

    // ✅ Fastest Lap Handling
    let fastestLap = validateTime(driver.timing?.bestLap || null, [2147483647]);

    // ✅ Finishing Position
    const finishPos = raceLeaderboard.indexOf(driver) + 1;

    // ✅ Handle cup_category correctly
    const cupCategory = driver.car?.cupCategory ?? null;
    const formattedCupCategory = (cupCategory === null || cupCategory === undefined) ? 'N/A' : cupCategory;

    return {
        fastestLap,
        averageLap: driverLaps.length
            ? Math.round(driverLaps.reduce((a, b) => a + b.laptime, 0) / driverLaps.length)
            : null,
        averageValidLap: validLaps.length
            ? Math.round(validLaps.reduce((a, b) => a + b, 0) / validLaps.length)
            : null,
        fastestPossibleLap,
        totalLaps: driverLaps.length,
        totalOffTracks: invalidLaps,
        totalRaceTime: driverTotalTime,
        leaderDelta,
        finishingPosition: finishPos,
        cupCategory: formattedCupCategory,
        fastest_s1,
        fastest_s2,
        fastest_s3
    };
}


// ✅ Main function to process session files
async function processSessionFiles() {
    console.log('🚀 Starting session file processing...');

    try {
        const files = fs.readdirSync(resultsPath).filter(file => file.endsWith('.json'));

        if (files.length === 0) {
            console.log('📂 No new session files found. Waiting for next run...');
            return;
        }

        for (const file of files) {
            const filePath = path.join(resultsPath, file);
            console.log(`📄 Processing file: ${file}`);

            const fileContent = loadData(filePath);

            // Extract Metadata
            const sessionType = detectSessionType(file);
            const trackId = fileContent.trackName?.toLowerCase().replace(/\s+/g, '_').trim();
            const serverName = fileContent.serverName || 'Unknown Server';
            const resultsName = file;
            const sessionDate = fileContent.Date || new Date().toISOString();
            const raceLeaderboard = fileContent.sessionResult?.leaderBoardLines || [];

            if (!sessionType || !trackId) {
                console.warn(`❌ SessionType or TrackID missing. Skipping session.`);
                continue;
            }

            let trackResult = await db.query(
                `SELECT track_id FROM track_info WHERE track_id = $1`,
                [trackId]
            );

            if (trackResult.rows.length === 0) {
                console.warn(`❌ Track not found in database: ${trackId}. Skipping session.`);
                continue;
            }

            const sessionResult = await db.query(
                `INSERT INTO session_info (track_id, session_type, session_name, results_name, date, uploaded_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [trackId, sessionType, serverName, resultsName, sessionDate]
            );

            const sessionId = sessionResult.rows[0].id;

            await ensureDriversExist(raceLeaderboard);

            for (const driver of raceLeaderboard) {
                const steamId = sanitizeSteamId(driver.car?.drivers?.[0]?.playerId);
                const carModelId = driver.car?.carModel; // Get carModelId from the driver data

                // ✅ Fetch car_id from car_info
                let carId = null;
                try {
                    const carResult = await db.query(
                        `SELECT car_id FROM car_info WHERE car_id = $1`,
                        [carModelId]
                    );

                    if (carResult.rows.length > 0) {
                        carId = carResult.rows[0].car_id;
                    } else {
                        console.warn(`⚠️ Car with ID ${carModelId} not found in car_info.`);
                        continue; // Skip this driver if car_id is invalid
                    }
                } catch (err) {
                    console.error(`❌ Failed to fetch car_id:`, err.message);
                    continue;
                }

                // ✅ Fetch car_model and car_class from car_info using car_id
                let carModel = null;
                let carClass = null;
                try {
                    const carDetails = await db.query(
                        `SELECT car_model, car_class FROM car_info WHERE car_id = $1`,
                        [carId]
                    );

                    if (carDetails.rows.length > 0) {
                        carModel = carDetails.rows[0].car_model;
                        carClass = carDetails.rows[0].car_class;
                    } else {
                        console.warn(`⚠️ No details found for car_id: ${carId}`);
                        carModel = 'Unknown Model';
                        carClass = 'UNKNOWN';
                    }
                } catch (err) {
                    console.error(`❌ Failed to fetch car details:`, err.message);
                    carModel = 'Unknown Model';
                    carClass = 'UNKNOWN';
                }

                const stats = extractDriverStats(driver, fileContent.laps || [], raceLeaderboard, sessionType);

                // ✅ Skip drivers who didn't finish (totalLaps === 0)
                if (stats.totalLaps === 0) {
                    console.warn(`⏩ Skipping driver ${steamId}: Did not finish the race (0 laps completed).`);
                    continue;
                }

                await db.query(
                    `INSERT INTO driver_session_stats 
                    (session_id, steam_id, car_id, car_model, car_class, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, cup_category, total_race_time, total_laps, total_off_tracks, fastest_possible_s1, fastest_possible_s2, fastest_possible_s3, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())`,
                    [
                        sessionId,
                        steamId,
                        carId,
                        carModel,
                        carClass,
                        stats.finishingPosition,
                        stats.leaderDelta,
                        stats.fastestLap !== null ? stats.fastestLap : null,
                        stats.averageLap !== null ? stats.averageLap : null,
                        stats.averageValidLap !== null ? stats.averageValidLap : null,
                        stats.fastestPossibleLap !== null ? stats.fastestPossibleLap : null,
                        stats.cupCategory !== null ? stats.cupCategory : null,
                        stats.totalRaceTime,
                        stats.totalLaps,
                        stats.totalOffTracks,
                        stats.fastest_s1,
                        stats.fastest_s2,
                        stats.fastest_s3
                    ]
                );
            }

            fs.renameSync(filePath, path.join(processedPath, file));
            console.log(`✅ Session ${file} processed successfully.`);

            await refreshDriverTrackInfo();

            // ✅ Refresh driver car track info
            await refreshDriverCarTrackInfo();
        }
    } catch (error) {
        console.error('❌ Failed to process session files:', error.message);
    }
}



// Periodic check for new files
setInterval(processSessionFiles, 0.5 * 60 * 1000);

// Initial run
processSessionFiles();
