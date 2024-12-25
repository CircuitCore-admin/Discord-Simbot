const fs = require('fs');
const path = require('path');
const db = require('./services/database');
const carModels = require('./data/carModels');

// Paths
const resultsPath = path.join(__dirname, 'results');
const processedPath = path.join(__dirname, 'processed');

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
        // ❌ If no completed laps, set leader_delta to NULL
        leaderDelta = null;
    } else if (sessionType === 'FP' || sessionType === 'Q') {
        // ✅ Free Practice & Qualifying
        if (driverFastestLap && leaderFastestLap) {
            const timeDelta = driverFastestLap - leaderFastestLap;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null; // Invalid lap times
        }
    } else if (sessionType === 'R') {
        // ✅ Race Sessions
        if (driverLapCount < leaderLapCount) {
            const lapDifference = leaderLapCount - driverLapCount;
            leaderDelta = `+${lapDifference} Lap${lapDifference > 1 ? 's' : ''}`;
        } else if (driverLapCount === leaderLapCount && leaderTotalTime > 0 && driverTotalTime > 0) {
            const timeDelta = driverTotalTime - leaderTotalTime;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null; // Default to NULL if neither condition applies
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
                const stats = extractDriverStats(driver, fileContent.laps || [], raceLeaderboard, sessionType);

                // ✅ Skip drivers who didn't finish (totalLaps === 0)
                if (stats.totalLaps === 0) {
                    console.warn(`⏩ Skipping driver ${steamId}: Did not finish the race (0 laps completed).`);
                    continue;
                }

                await db.query(
                    `INSERT INTO driver_session_stats 
                    (session_id, steam_id, car_model, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, cup_category, total_race_time, total_laps, total_off_tracks, fastest_possible_s1, fastest_possible_s2, fastest_possible_s3)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                    [
                        sessionId,
                        steamId,
                        driver.car?.carModel,
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
        }
    } catch (error) {
        console.error('❌ Failed to process session files:', error.message);
    }
}


// Periodic check for new files
setInterval(processSessionFiles, 1 * 60 * 1000);

// Initial run
processSessionFiles();
