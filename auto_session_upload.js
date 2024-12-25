const fs = require('fs');
const path = require('path');
const db = require('./services/database');
const carModels = require('./data/carModels');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Dynamic import for node-fetch v3+

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
            // Check if driver exists in driver_info
            let driverResult = await db.query(
                `SELECT steam_id FROM driver_info WHERE steam_id = $1`,
                [steamId]
            );

            if (driverResult.rows.length === 0) {
                // Add driver if they don't exist
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

            try {
                const fileContent = loadData(filePath);

                // Extract Metadata
                const sessionMeta = fileContent.sessionInfo || {};
                const driverStats = fileContent.sessionResult?.leaderBoardLines || [];
                const lapsData = fileContent.laps || [];

                const sessionName = sessionMeta.name || file.split('.')[0];
                const sessionType = detectSessionType(file);

                if (!sessionType) {
                    console.warn(`❌ Unknown session type in ${file}. Skipping.`);
                    continue;
                }

                // ✅ Extract track ID from `trackName`
                const trackId = fileContent.trackName?.toLowerCase().replace(/\s+/g, '_').trim();

                if (!trackId) {
                    console.warn(`❌ Track ID (trackName) missing from metadata. Skipping session.`);
                    continue;
                }

                // ✅ Validate track exists in `track_info`
                let trackResult = await db.query(
                    `SELECT track_id FROM track_info WHERE track_id = $1`,
                    [trackId]
                );

                if (trackResult.rows.length === 0) {
                    console.warn(`❌ Track not found in database: ${trackId}. Skipping session.`);
                    continue;
                }

                console.log(`🔗 Found track: ${trackId}`);

                // ✅ Insert session info
                const sessionResult = await db.query(
                    `INSERT INTO session_info (track_id, session_type, session_name, date) 
                    VALUES ($1, $2, $3, NOW()) RETURNING id`,
                    [trackId, sessionType, file]
                );

                const sessionId = sessionResult.rows[0].id; // Correct reference to "id"
                console.log(`✅ Added session: ${file} (${sessionType})`);

                // ✅ Ensure all drivers exist before proceeding
                await ensureDriversExist(driverStats);

                // ✅ Insert driver stats
                for (const driver of driverStats) {
                    let steamId = sanitizeSteamId(driver.car?.drivers?.[0]?.playerId);

                    const carModel = carModels[driver.car?.carModel] || driver.car?.carModel || 'N/A';
                    const finishingPosition = driver.position || null;
                    const leaderDelta = driver.timing?.gap || null;
                    const fastestLap = driver.timing?.bestLap || null;
                    const averageLap = driver.timing?.avgLap || null;
                    const averageValidLap = driver.timing?.avgValidLap || null;
                    const fastestPossibleLap = driver.timing?.optimalLap || null;
                    const totalLaps = driver.timing?.lapCount || 0;
                    const totalOffTracks = driver.timing?.offTracks || 0;

                    await db.query(
                        `INSERT INTO driver_session_stats 
                        (session_id, steam_id, car_model, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, total_laps, total_off_tracks)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                        [
                            sessionId, steamId, carModel, finishingPosition, leaderDelta,
                            fastestLap, averageLap, averageValidLap, fastestPossibleLap, totalLaps, totalOffTracks
                        ]
                    );
                    console.log(`✅ Added driver stats for session: ${sessionName}, SteamID: ${steamId}`);
                }

                console.log(`✅ Processed drivers for session: ${sessionName}`);
                fs.renameSync(filePath, path.join(processedPath, file));
            } catch (err) {
                console.error(`❌ Error processing file ${file}:`, err.message);
            }
        }

        console.log('✅ All session files processed.');
    } catch (error) {
        console.error('❌ Failed to process session files:', error.message);
    }
}

// Initial run
processSessionFiles();
