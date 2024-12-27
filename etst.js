const fs = require('fs');
const path = require('path');
const db = require('./services/database');

// ✅ Load JSON Data
function loadData(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`❌ Failed to load JSON data: ${error.message}`);
        process.exit(1);
    }
}

// ✅ Extract Unique Car IDs from Laps
function extractCarIds(lapsData) {
    return [...new Set(lapsData.map(lap => lap.carId))];
}

// ✅ Main function to process session files
async function processSessionFiles() {
    console.log('🚀 Starting session file processing...');

    try {
        const resultsPath = path.join(__dirname, 'results');
        const processedPath = path.join(__dirname, 'processed');
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
            const lapsData = fileContent.laps || [];

            if (!sessionType || !trackId) {
                console.warn(`❌ SessionType or TrackID missing. Skipping session.`);
                continue;
            }

            // Validate Track
            const trackResult = await db.query(
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

            // ✅ Extract Car IDs from laps
            const carIds = extractCarIds(lapsData);

            for (const carId of carIds) {
                const carEntry = raceLeaderboard.find(entry => entry.car?.carId === carId);

                if (!carEntry?.car?.drivers) {
                    console.warn(`⚠️ No drivers found for CarID: ${carId}`);
                    continue;
                }

                const drivers = carEntry.car.drivers;

                for (let driverIndex = 0; driverIndex < drivers.length; driverIndex++) {
                    const driver = drivers[driverIndex];
                    const steamId = sanitizeSteamId(driver.playerId);

                    if (!steamId) {
                        console.warn(`❌ Missing SteamID for driver in CarID: ${carId}`);
                        continue;
                    }

                    const driverLaps = lapsData.filter(
                        lap => lap.carId === carId && lap.driverIndex === driverIndex
                    );

                    const validDriverLaps = driverLaps.filter(lap => lap.isValidForBest);
                    const totalLaps = driverLaps.length;
                    const validLaps = validDriverLaps.length;

                    const avgLapTime = totalLaps > 0
                        ? Math.round(driverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / totalLaps)
                        : null;

                    const avgValidLapTime = validLaps > 0
                        ? Math.round(validDriverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / validLaps)
                        : null;

                    const fastestValidLap = validLaps > 0
                        ? Math.min(...validDriverLaps.map(lap => lap.laptime))
                        : null;

                    const totalDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

                    if (totalLaps === 0) {
                        console.warn(`⏩ Skipping driver ${steamId}: Did not finish the race (0 laps completed).`);
                        continue;
                    }

                    await db.query(
                        `INSERT INTO driver_session_stats 
                        (session_id, steam_id, car_id, car_model_id, car_model, car_class, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, cup_category, total_race_time, total_laps, total_off_tracks, fastest_possible_s1, fastest_possible_s2, fastest_possible_s3, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())`,
                        [
                            sessionId,
                            steamId,
                            carId, // ✅ Inserted carId here
                            carEntry.car?.carModel,
                            carEntry.car?.carModel || 'Unknown Model',
                            carEntry.car?.carClass || 'UNKNOWN',
                            raceLeaderboard.indexOf(carEntry) + 1,
                            null, // Placeholder for leader_delta
                            fastestValidLap,
                            avgLapTime,
                            avgValidLapTime,
                            null, // Placeholder for fastest_possible_lap
                            null, // Placeholder for cup_category
                            totalDriveTime,
                            totalLaps,
                            totalLaps - validLaps, // Total off-tracks
                            null, null, null // Placeholders for sector times
                        ]
                    );

                    console.log(`✅ Inserted stats for driver ${steamId} in CarID: ${carId}`);
                }
            }

            fs.renameSync(filePath, path.join(processedPath, file));
            console.log(`✅ Session ${file} processed successfully.`);

            await markTeamEvent(sessionId);
            await refreshDriverTrackInfo();
            await refreshDriverCarTrackInfo();
        }
    } catch (error) {
        console.error('❌ Failed to process session files:', error.message);
    }
}

// ✅ Initial Run
processSessionFiles();
