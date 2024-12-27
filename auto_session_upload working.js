const fs = require('fs');
const path = require('path');
const db = require('./services/database');
const carModels = require('./data/carModels');

const loadSQL = (file) => fs.readFileSync(path.join(__dirname, `./services/queries/${file}`), 'utf-8');

// ✅ Query Functions
const driverInfoQuery = loadSQL('driverInfo.sql');
const driverTrackInfoQuery = loadSQL('driverTrackInfo.sql');
const driverCarTrackInfoQuery = loadSQL('driverCarTrackInfo.sql');
const teamSessionStatsQuery = loadSQL('teamSessionStats.sql');
const teamDriverStatsQuery = loadSQL('teamDriverStats.sql');

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
                // console.log(`🆕 Added new driver: ${steamId}`);
            } else {
                // console.log(`🔗 Found driver: ${steamId}`);
            }
        } catch (err) {
            console.error(`❌ Failed to ensure driver exists for ${realName}:`, err.message);
        }
    }
}

// ✅ Refresh Driver Info
async function refreshDriverInfo() {
    try {
        await db.query(driverInfoQuery);
        console.log('✅ Driver info refreshed.');
    } catch (error) {
        console.error('❌ Error refreshing driver info:', error.message);
    }
}

// ✅ Refresh Driver Track Info
async function refreshDriverTrackInfo() {
    try {
        await db.query(driverTrackInfoQuery);
        console.log('✅ Driver track info refreshed.');
    } catch (error) {
        console.error('❌ Error refreshing driver track info:', error.message);
    }
}

// ✅ Refresh Team Session Stats
async function refreshTeamSessionStats(sessionId) {
    try {
        await db.query(teamSessionStatsQuery, [sessionId]);
        console.log('✅ Team session stats refreshed.');
    } catch (error) {
        console.error('❌ Error refreshing team session stats:', error.message);
    }
}

// ✅ Refresh Team Driver Stats
async function refreshTeamDriverStats() {
    try {
        await db.query(teamDriverStatsQuery);
        console.log('✅ Team driver stats refreshed.');
    } catch (error) {
        console.error('❌ Error refreshing team driver stats:', error.message);
    }
}

async function markTeamEvent(sessionId) {
    try {
        const result = await db.query(`
            SELECT COUNT(DISTINCT steam_id) AS unique_drivers
            FROM driver_session_stats
            WHERE session_id = $1
            GROUP BY car_id
            HAVING COUNT(DISTINCT steam_id) > 1
        `, [sessionId]);

        if (result.rows.length > 0) {
            await db.query(`
                UPDATE session_info 
                SET is_team_event = TRUE 
                WHERE id = $1
            `, [sessionId]);

            console.log(`🏁 Session ${sessionId} marked as TEAM event.`);
        } else {
            console.log(`🧍 Session ${sessionId} is a SOLO event.`);
        }
    } catch (error) {
        console.error(`❌ Failed to mark session as TEAM event:`, error.message);
    }
}



// ✅ Refresh Driver Car Track Info
async function refreshDriverCarTrackInfo() {
    try {
        await db.query(driverCarTrackInfoQuery);
        console.log('✅ Driver Car Track Info refreshed successfully.');
    } catch (error) {
        console.error('❌ Failed to refresh Driver Car Track Info:', error.message);
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
// ✅ Enhanced Main function to process every driver per car
// ✅ Helper Function: Fetch Car Details
async function fetchCarDetails(carModelId) {
    try {
        const carResult = await db.query(
            `SELECT car_id FROM car_info WHERE car_id = $1`, [carModelId]
        );

        if (carResult.rows.length === 0) {
            console.warn(`⚠️ Car with ID ${carModelId} not found in car_info.`);
            return { carId: null, carModel: 'Unknown Model', carClass: 'UNKNOWN' };
        }

        const carDetails = await db.query(
            `SELECT car_model, car_class FROM car_info WHERE car_id = $1`, [carResult.rows[0].car_id]
        );

        return carDetails.rows.length > 0
            ? { carId: carResult.rows[0].car_id, carModel: carDetails.rows[0].car_model, carClass: carDetails.rows[0].car_class }
            : { carId: null, carModel: 'Unknown Model', carClass: 'UNKNOWN' };
    } catch (err) {
        console.error(`❌ Failed to fetch car details:`, err.message);
        return { carId: null, carModel: 'Unknown Model', carClass: 'UNKNOWN' };
    }
}

// ✅ Helper Function: Process a Single Driver
async function processDriver(driver, sessionId, carModelId, carId, carModel, carClass, stats, carId, driverLapsCount) {
    const steamId = sanitizeSteamId(driver.playerId);
    const firstName = driver.firstName || 'Unknown';
    const lastName = driver.lastName || 'Driver';
    const realName = `${firstName} ${lastName}`.trim();

    if (!steamId) {
        console.warn(`⚠️ Missing SteamID for driver ${realName}. Skipping.`);
        return;
    }

    // ✅ Add Driver to driver_info
    await db.query(
        `INSERT INTO driver_info (steam_id, real_name) 
         VALUES ($1, $2) ON CONFLICT (steam_id) DO NOTHING`,
        [steamId, realName]
    );

    // ✅ Skip if no laps completed
    if (stats.totalLaps === 0) {
        console.warn(`⏩ Skipping driver ${steamId}: Did not finish the race (0 laps completed).`);
        return;
    }

    // ✅ Add Driver Session Stats
    await db.query(
        `INSERT INTO driver_session_stats 
        (session_id, steam_id, car_model_id, car_model, car_class, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, cup_category, total_race_time, total_laps, total_off_tracks, fastest_possible_s1, fastest_possible_s2, fastest_possible_s3, car_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())`,
        [
            sessionId,
            steamId,
            carModelId,
            carModel,
            carClass,
            stats.finishingPosition,
            stats.leaderDelta,
            stats.fastestLap,
            stats.averageLap,
            stats.averageValidLap,
            stats.fastestPossibleLap,
            stats.cupCategory,
            stats.totalRaceTime,
            driverLapsCount,
            stats.totalOffTracks,
            stats.fastest_s1,
            stats.fastest_s2,
            stats.fastest_s3,
            carId
        ]
    );

    // console.log(`🆕 Driver Processed: ${realName} (SteamID: ${steamId})`);
}

// ✅ Calculate Fastest Possible Time
function calculateFastestPossibleTime(laps) {
    const bestSectors = [Infinity, Infinity, Infinity];

    laps.forEach(lap => {
        if (lap.isValidForBest && lap.splits) {
            lap.splits.forEach((split, index) => {
                if (split < bestSectors[index]) {
                    bestSectors[index] = split;
                }
            });
        }
    });

    return bestSectors.every(split => split !== Infinity)
        ? bestSectors.reduce((a, b) => a + b, 0)
        : 'N/A';
}

// ✅ Main Session Processing Function
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
            const raceLeaderboard = fileContent.sessionResult?.leaderBoardLines || [];
            const lapsData = fileContent.laps || [];
            const carIds = new Set(lapsData.map(lap => lap.carId));

            // ✅ Extract Metadata
            const sessionType = detectSessionType(file);
            const trackId = fileContent.trackName?.toLowerCase().replace(/\s+/g, '_').trim();
            const serverName = fileContent.serverName || 'Unknown Server';
            const resultsName = file;
            const sessionDate = fileContent.Date || new Date().toISOString();

            if (!sessionType || !trackId) {
                console.warn(`❌ SessionType or TrackID missing. Skipping session.`);
                continue;
            }

            const trackResult = await db.query(`SELECT track_id FROM track_info WHERE track_id = $1`, [trackId]);
            if (trackResult.rows.length === 0) {
                console.warn(`❌ Track not found in database: ${trackId}. Skipping session.`);
                continue;
            }

            // Check for multiple drivers per carId before continuing
            let isDriverSwapRace = false;
            for (const carEntry of raceLeaderboard) {
                if (carEntry.car?.drivers && carEntry.car.drivers.length > 1) {
                    isDriverSwapRace = true;
                    break;
                }
            }

            // if (isDriverSwapRace) {
            // Perform the other section of code for driver swap races here
            console.log(`🔄 Driver swap race detected. Processing driver swap logic...`);
            // YOUR DRIVER SWAP CODE HERE
            //         const sessionResult = await db.query(
            //             `INSERT INTO session_info (track_id, session_type, session_name, results_name, date, uploaded_at) 
            //   VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
            //             [trackId, sessionType, serverName, resultsName, sessionDate]
            //         );

            //         const sessionId = sessionResult.rows[0].id;

            //         await ensureDriversExist(raceLeaderboard);

            // for (const carId of carIds) {
            //     const carEntry = raceLeaderboard.find(entry => entry.car?.carId === carId);

            //     if (!carEntry?.car?.drivers) {
            //         console.warn(`⚠️ No drivers found for CarID: ${carId}`);
            //         continue;
            //     }

            //     const drivers = carEntry.car.drivers;

            //     let teamTotalLaps = 0, teamValidLaps = 0, teamDriveTime = 0;
            //     let teamLapTimes = [], teamValidLapTimes = [], teamLapsForSplits = [];
            //     let teamFastestValidLap = Infinity;

            //     for (const [driverIndex, driver] of drivers.entries()) {
            //         const driverLaps = lapsData.filter(lap => lap.carId === carId && lap.driverIndex === driverIndex);
            //         const validDriverLaps = driverLaps.filter(lap => lap.isValidForBest);

            //         const avgLapTime = driverLaps.length > 0
            //             ? Math.round(driverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / driverLaps.length)
            //             : 'N/A';

            //         const avgValidLapTime = validDriverLaps.length > 0
            //             ? Math.round(validDriverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / validDriverLaps.length)
            //             : 'N/A';

            //         const fastestValidLap = validDriverLaps.length > 0
            //             ? Math.min(...validDriverLaps.map(lap => lap.laptime))
            //             : 'N/A';

            //         const fastestPossibleTime = await calculateFastestPossibleTime(validDriverLaps);

            //         const driverDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

            //         teamTotalLaps += driverLaps.length;
            //         teamValidLaps += validDriverLaps.length;
            //         teamLapTimes.push(...driverLaps.map(lap => lap.laptime));
            //         teamValidLapTimes.push(...validDriverLaps.map(lap => lap.laptime));
            //         teamLapsForSplits.push(...validDriverLaps);
            //         teamFastestValidLap = Math.min(teamFastestValidLap, fastestValidLap !== 'N/A' ? fastestValidLap : Infinity);
            //         teamDriveTime += driverDriveTime;

            //         // console.log(`   👤 Driver ${driverIndex + 1}:`);
            //         // console.log(`      - Name: ${driver?.firstName || 'Unknown'} ${driver?.lastName || 'Unknown'}`);
            //         // console.log(`      - Total Laps: ${driverLaps.length}`);
            //         // console.log(`      - Average Lap Time: ${avgLapTime}`);
            //         // console.log(`      - Valid Laps: ${validDriverLaps.length}`);
            //         // console.log(`      - Average Valid Lap Time: ${avgValidLapTime}`);
            //         // console.log(`      - Fastest Lap Time: ${fastestValidLap}`);
            //         // console.log(`      - Fastest Possible Time: ${fastestPossibleTime}`);
            //         // console.log(`      - Total Drive Time: ${driverDriveTime}`);
            //         // console.log('--------------------------------');
            //     }

            //     const avgTeamLapTime = teamLapTimes.length > 0
            //         ? Math.round(teamLapTimes.reduce((sum, lap) => sum + lap, 0) / teamLapTimes.length)
            //         : 'N/A';

            //     const avgTeamValidLapTime = teamValidLapTimes.length > 0
            //         ? Math.round(teamValidLapTimes.reduce((sum, lap) => sum + lap, 0) / teamValidLapTimes.length)
            //         : 'N/A';

            //     const fastestPossibleTeamTime = calculateFastestPossibleTime(teamLapsForSplits);

            //     // console.log(`🏁 Team Stats for Car ID: ${carId}`);
            //     // console.log(`   - Total Team Laps: ${teamTotalLaps}`);
            //     // console.log(`   - Fastest Team Lap: ${teamFastestValidLap}`);
            //     // console.log(`   - Fastest Possible Team Lap: ${fastestPossibleTeamTime}`);
            //     // console.log(`   - Average Team Lap Time: ${avgTeamLapTime}`);
            //     // console.log(`   - Average Valid Team Lap Time: ${avgTeamValidLapTime}`);
            //     // console.log(`   - Total Team Drive Time: ${teamDriveTime}`);
            //     // console.log('================================\n');
            // }
            // } else {
            console.log(`🚗 Single driver race detected. Processing regular logic...`);
            // Regular processing logic goes here

            const sessionResult = await db.query(
                `INSERT INTO session_info (track_id, session_type, session_name, results_name, date, uploaded_at) 
          VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [trackId, sessionType, serverName, resultsName, sessionDate]
            );

            const sessionId = sessionResult.rows[0].id;

            await ensureDriversExist(raceLeaderboard);

            for (const carId of carIds) {
                const carEntry = raceLeaderboard.find(entry => entry.car?.carId === carId);

                if (!carEntry?.car?.drivers) {
                    console.warn(`⚠️ No drivers found for CarID: ${carId}`);
                    continue;
                }

                const drivers = carEntry.car.drivers;

                let teamTotalLaps = 0,
                    teamValidLaps = 0,
                    teamDriveTime = 0;
                let teamLapTimes = [],
                    teamValidLapTimes = [],
                    teamLapsForSplits = [];
                let teamFastestValidLap = Infinity;

                for (const [driverIndex, driver] of drivers.entries()) {
                    const driverLaps = lapsData.filter(lap => lap.carId === carId && lap.driverIndex === driverIndex);
                    const validDriverLaps = driverLaps.filter(lap => lap.isValidForBest);

                    const avgLapTime = driverLaps.length > 0
                        ? Math.round(driverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / driverLaps.length)
                        : 'N/A';

                    const avgValidLapTime = validDriverLaps.length > 0
                        ? Math.round(validDriverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / validDriverLaps.length)
                        : 'N/A';

                    const fastestValidLap = validDriverLaps.length > 0
                        ? Math.min(...validDriverLaps.map(lap => lap.laptime))
                        : 'N/A';

                    const fastestPossibleTime = await calculateFastestPossibleTime(validDriverLaps);
                    // console.log(driverLaps)
                    const carModelId = carEntry.car?.carModel;
                    const resolvedCarId = carEntry.car?.carId;
                    const { carId: finalCarId, carModel, carClass } = await fetchCarDetails(carModelId);

                    const stats = extractDriverStats(carEntry, lapsData, raceLeaderboard, sessionType);

                    // console.log(driver);
                    await processDriver(driver, sessionId, carModelId, finalCarId, carModel, carClass, stats, resolvedCarId, driverLaps.length);

                    const driverDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

                    teamTotalLaps += driverLaps.length;
                    // console.log(teamTotalLaps)
                    teamValidLaps += validDriverLaps.length;
                    teamLapTimes.push(...driverLaps.map(lap => lap.laptime));
                    teamValidLapTimes.push(...validDriverLaps.map(lap => lap.laptime));
                    teamLapsForSplits.push(...validDriverLaps);
                    teamFastestValidLap = Math.min(teamFastestValidLap, fastestValidLap !== 'N/A' ? fastestValidLap : Infinity);
                    teamDriveTime += driverDriveTime;
                }

                const avgTeamLapTime = teamLapTimes.length > 0
                    ? Math.round(teamLapTimes.reduce((sum, lap) => sum + lap, 0) / teamLapTimes.length)
                    : 'N/A';

                const avgTeamValidLapTime = teamValidLapTimes.length > 0
                    ? Math.round(teamValidLapTimes.reduce((sum, lap) => sum + lap, 0) / teamValidLapTimes.length)
                    : 'N/A';

                const fastestPossibleTeamTime = calculateFastestPossibleTime(teamLapsForSplits);

                // console.log(`🏁 Team Stats for Car ID: ${carId}`);
                // console.log(`   - Total Team Laps: ${teamTotalLaps}`);
                // console.log(`   - Fastest Team Lap: ${teamFastestValidLap}`);
                // console.log(`   - Fastest Possible Team Lap: ${fastestPossibleTeamTime}`);
                // console.log(`   - Average Team Lap Time: ${avgTeamLapTime}`);
                // console.log(`   - Average Valid Team Lap Time: ${avgTeamValidLapTime}`);
                // console.log(`   - Total Team Drive Time: ${teamDriveTime}`);
                // console.log('================================\n');
            }


            fs.renameSync(filePath, path.join(processedPath, file));
            console.log(`✅ Session ${file} processed successfully.`);

            await markTeamEvent(sessionId);
            await ensureDriversExist(raceLeaderboard);
            await refreshDriverTrackInfo();
            await refreshDriverCarTrackInfo();
            // }
        }
    } catch (error) {
        console.error('❌ Failed to process session files:', error.message);
    }
}

// Periodic check for new files
setInterval(processSessionFiles, 0.5 * 60 * 1000);

// Initial run
processSessionFiles();