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
const driverCarInfoQuery = loadSQL('driverCarInfo.sql');

// Paths
const resultsPath = path.join(__dirname, 'results_cleaned');
const processedPath = path.join(__dirname, 'processed');
const entrylistPath = path.join(__dirname, 'entrylists');

// ✅ Import the car class helper
const { getCarClass, getCarModel } = require('./helpers/carClassHelper');
const { log } = require('console');

// ✅ Helper function to sanitize SteamID
function sanitizeSteamId(steamId) {
    return steamId ? steamId.replace(/\D/g, '') : null;
}

// ✅ Helper function to format lap time
const formatLapTime = ms => {
    if (ms === 'N/A' || ms == null) return null;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.round(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

// ✅ Detect session type based on file name
function detectSessionType(fileName) {
    if (fileName.includes('FP')) return 'FP';
    if (fileName.includes('Q')) return 'Q';
    if (fileName.includes('R')) return 'R';
    if (fileName.includes('entrylist')) return 'entrylist';
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

// ✅ Refresh Driver Car Track Info
async function refreshCarInfo() {
    try {
        await db.query(driverCarInfoQuery);
        console.log('✅ Driver Car Info refreshed successfully.');
    } catch (error) {
        console.error('❌ Failed to refresh Driver Car Info:', error.message);
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


function sanitizeNumeric(value) {
    return (value === 'N/A' || value == null || isNaN(value)) ? null : value;
}

async function processTeamEvent(carId, carEntry, sessionId, sessionType, lapsData, raceLeaderboard) {
    if (!carId || !carEntry || !carEntry.car) {
        console.warn(`⚠️ Invalid CarID or missing car data for team event. Skipping.`);
        return;
    }

    if (!carEntry.car.drivers || carEntry.car.drivers.length === 0) {
        console.warn(`⚠️ No drivers found for CarID: ${carId}. Skipping team event.`);
        return;
    }

    // console.log(carEntry);
    const drivers = carEntry.car.drivers;
    const car_model_id = carEntry.car.carModel || 'Unknown Model'; // Extract carModel for the team
    const cupCategory = carEntry.car.cupCategory ?? 0; // Extract cupCategory explicitly, default to 0 if undefined

    let teamTotalLaps = 0,
        teamValidLaps = 0,
        teamDriveTime = 0;
    let teamLapTimes = [],
        teamValidLapTimes = [],
        teamLapsForSplits = [];
    let teamFastestValidLap = Infinity;

    // 🏁 Extract finishing position and leader information
    const finishingPosition = raceLeaderboard.findIndex(entry => entry.car?.carId === carId) + 1;

    const leaderEntry = raceLeaderboard[0] || {};
    const leaderLaps = leaderEntry?.timing?.lapCount || 0;
    const leaderBestLap = leaderEntry?.timing?.bestLap || 'N/A';
    const leaderTotalTime = leaderEntry?.timing?.totalTime || 'N/A';

    // const leaderTotalTime = raceLeaderboard[0]?.timing?.totalTime || 0;
    const driverTotalTime = carEntry.timing?.totalTime || 0;
    const driverLapCount = carEntry.timing?.lapCount || 0;
    const hasCompletedLaps = driverLapCount > 0;
    const leaderLapCount = raceLeaderboard[0]?.timing?.lapCount || 0;
    const driverFastestLap = carEntry.timing?.bestLap || null;

    if (!hasCompletedLaps) {
        console.warn(`⚠️ Driver ${driverIndex} has not completed any laps. Skipping.`);
        leaderDelta = null;
    } else if (sessionType === 'FP' || sessionType === 'Q') {
        if (driverFastestLap && leaderBestLap) {
            const timeDelta = driverFastestLap - leaderBestLap;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    } else if (sessionType === 'R') {
        if (driverLapCount < leaderLaps) {
            const lapDifference = leaderLapCount - driverLapCount;
            leaderDelta = `+${lapDifference} lap${lapDifference > 1 ? 's' : ''}`;
        } else if (driverLapCount === leaderLapCount && leaderTotalTime > 0 && driverTotalTime > 0) {
            const timeDelta = driverTotalTime - leaderTotalTime;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    }

    // console.log(leaderDelta)
    const leaderInfo = {
        leaderLaps,
        leaderBestLap,
        leaderTotalTime
    };

    // 🗂️ Extract totalTime from raceLeaderboard accurately
    const totalTimeFromLeaderboard = raceLeaderboard.find(entry => entry.car?.carId === carId)?.timing?.totalTime || null;

    // 🗂️ Group laps by driverIndex
    const groupedLapsByDriverIndex = {};
    lapsData
        .filter(lap => lap.carId === carId)
        .forEach(lap => {
            if (!groupedLapsByDriverIndex[lap.driverIndex]) {
                groupedLapsByDriverIndex[lap.driverIndex] = [];
            }
            groupedLapsByDriverIndex[lap.driverIndex].push(lap);
        });

    const driverStats = [];

    // 🚦 Iterate through drivers and map them to grouped lap data
    for (let driverIndex = 0; driverIndex < drivers.length; driverIndex++) {
        const driver = drivers[driverIndex];
        const driverLaps = groupedLapsByDriverIndex[driverIndex] || [];
        const validDriverLaps = driverLaps.filter(lap => lap.isValidForBest);
        const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);
        // ✅ Sanitize SteamID
        const steamIdRaw = driver?.playerId || `Unknown_ID_${driverIndex}`;
        const steamId = sanitizeSteamId(steamIdRaw);

        // ✅ Get carModel for the driver (fallback to team carModel)
        // const driverCarModel = driver?.car?.carModel || carModel || 'Unknown Model';

        const avgLapTime = driverLaps.length > 0
            ? sanitizeNumeric(Math.round(driverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / driverLaps.length))
            : null;

        // ✅ Calculate Average Valid Lap Time
        const avgValidLapTime = validDriverLaps.length > 0
            ? sanitizeNumeric(Math.round(validDriverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / validDriverLaps.length))
            : null;

        // ✅ Calculate Fastest Valid Lap
        const fastestValidLap = validDriverLaps.length > 0
            ? sanitizeNumeric(Math.min(...validDriverLaps.map(lap => lap.laptime)))
            : null;


        const fastestPossibleTime = await calculateFastestPossibleTime(validDriverLaps);

        const driverDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

        // 🏁 Initialize static fastest splits
        let fastest_s1 = null;
        let fastest_s2 = null;
        let fastest_s3 = null;

        validDriverLaps.forEach(lap => {
            if (lap.splits) {
                lap.splits.forEach((splitTime, splitIndex) => {
                    if (splitIndex === 0 && (fastest_s1 === null || splitTime < fastest_s1)) {
                        fastest_s1 = splitTime;
                    }
                    if (splitIndex === 1 && (fastest_s2 === null || splitTime < fastest_s2)) {
                        fastest_s2 = splitTime;
                    }
                    if (splitIndex === 2 && (fastest_s3 === null || splitTime < fastest_s3)) {
                        fastest_s3 = splitTime;
                    }
                });
            }
        });

        // Extract lap count for the current driver
        const driverLapCount = raceLeaderboard.find(entry => entry.car?.carId === carId)?.timing?.lapCount || 0;

        const carInfo = await fetchCarDetails(car_model_id);

        const driverStat = {
            steamId, // ✅ Sanitized SteamID
            carId, // ✅ CarID for the driver
            carModel: carInfo.carModel, // ✅ CarID for the driver
            car_model_id,
            name: `${driver?.firstName || 'Unknown'} ${driver?.lastName || 'Driver'}`, // ✅ Driver Name
            cupCategory, // ✅ Cup Category for the driver
            finishingPosition, // ✅ Finishing Position
            leaderDelta, // ✅ Leader Delta
            driverIndex, // ✅ Driver Index
            totalLaps: driverLaps.length,
            validLaps: validDriverLaps.length,
            avgLapTime,
            avgValidLapTime,
            fastestValidLap,
            fastestPossibleTime,
            totalDriveTime: totalTimeFromLeaderboard,
            fastest_s1,
            fastest_s2,
            fastest_s3,
            carClass: carInfo.carClass, // ✅ CarClass for the driver
            driverDriveTime
        };

        driverStats.push(driverStat);

        // Insert driver stats into the database
        await insertDriverStatsIntoDatabase(sessionId, driverStat);

        // Aggregate team stats
        teamTotalLaps += driverLaps.length;
        teamValidLaps += validDriverLaps.length;
        teamLapTimes.push(...driverLaps.map(lap => lap.laptime));
        teamValidLapTimes.push(...validDriverLaps.map(lap => lap.laptime));
        teamLapsForSplits.push(...validDriverLaps);
        teamFastestValidLap = Math.min(teamFastestValidLap, fastestValidLap !== null ? fastestValidLap : Infinity);
        teamDriveTime += driverDriveTime;
    }

    // await logDriverStats(driverStats, sessionId, totalTimeFromLeaderboard);

    const avgTeamLapTime = teamLapTimes.length > 0
        ? sanitizeNumeric(Math.round(teamLapTimes.reduce((sum, lap) => sum + lap, 0) / teamLapTimes.length))
        : null;

    const avgTeamValidLapTime = teamValidLapTimes.length > 0
        ? sanitizeNumeric(Math.round(teamValidLapTimes.reduce((sum, lap) => sum + lap, 0) / teamValidLapTimes.length))
        : null;

    const fastestPossibleTeamTime = calculateFastestPossibleTime(teamLapsForSplits);

    const teamStats = {
        carId,
        car_model_id,
        cupCategory, // ✅ Added cupCategory to teamStats
        finishingPosition,
        leaderDelta, // Removed from here, handled per driver
        teamTotalLaps,
        teamFastestValidLap,
        fastestPossibleTeamTime,
        avgTeamLapTime,
        avgTeamValidLapTime,
        teamDriveTime,
        totalTime: totalTimeFromLeaderboard, // ✅ Added totalTime from results
        drivers: driverStats
    };
}

async function processSoloEvent(carId, carEntry, sessionId, sessionType, lapsData, raceLeaderboard) {
    if (!carId || !carEntry || !carEntry.car) {
        console.warn(`⚠️ Invalid CarID or missing car data for team event. Skipping.`);
        return;
    }

    if (!carEntry.car.drivers || carEntry.car.drivers.length === 0) {
        console.warn(`⚠️ No drivers found for CarID: ${carId}. Skipping team event.`);
        return;
    }

    // console.log(carEntry);
    const drivers = carEntry.car.drivers;
    const car_model_id = carEntry.car.carModel || 'Unknown Model'; // Extract carModel for the team
    const cupCategory = carEntry.car.cupCategory ?? 0; // Extract cupCategory explicitly, default to 0 if undefined

    let teamTotalLaps = 0,
        teamValidLaps = 0,
        teamDriveTime = 0;
    let teamLapTimes = [],
        teamValidLapTimes = [],
        teamLapsForSplits = [];
    let teamFastestValidLap = Infinity;

    // 🏁 Extract finishing position and leader information
    const finishingPosition = raceLeaderboard.findIndex(entry => entry.car?.carId === carId) + 1;

    const leaderEntry = raceLeaderboard[0] || {};
    const leaderLaps = leaderEntry?.timing?.lapCount || 0;
    const leaderBestLap = leaderEntry?.timing?.bestLap || 'N/A';
    const leaderTotalTime = leaderEntry?.timing?.totalTime || 'N/A';

    // const leaderTotalTime = raceLeaderboard[0]?.timing?.totalTime || 0;
    const driverTotalTime = carEntry.timing?.totalTime || 0;
    const driverLapCount = carEntry.timing?.lapCount || 0;
    const hasCompletedLaps = driverLapCount > 0;
    const leaderLapCount = raceLeaderboard[0]?.timing?.lapCount || 0;
    const driverFastestLap = carEntry.timing?.bestLap || null;

    if (!hasCompletedLaps) {
        console.warn(`⚠️ Driver ${driverIndex} has not completed any laps. Skipping.`);
        leaderDelta = null;
    } else if (sessionType === 'FP' || sessionType === 'Q') {
        if (driverFastestLap && leaderBestLap) {
            const timeDelta = driverFastestLap - leaderBestLap;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    } else if (sessionType === 'R') {
        if (driverLapCount < leaderLaps) {
            const lapDifference = leaderLapCount - driverLapCount;
            leaderDelta = `+${lapDifference} lap${lapDifference > 1 ? 's' : ''}`;
        } else if (driverLapCount === leaderLapCount && leaderTotalTime > 0 && driverTotalTime > 0) {
            const timeDelta = driverTotalTime - leaderTotalTime;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    }

    // console.log(leaderDelta)
    const leaderInfo = {
        leaderLaps,
        leaderBestLap,
        leaderTotalTime
    };

    // 🗂️ Extract totalTime from raceLeaderboard accurately
    const totalTimeFromLeaderboard = raceLeaderboard.find(entry => entry.car?.carId === carId)?.timing?.totalTime || null;

    // 🗂️ Group laps by driverIndex
    const groupedLapsByDriverIndex = {};
    lapsData
        .filter(lap => lap.carId === carId)
        .forEach(lap => {
            if (!groupedLapsByDriverIndex[lap.driverIndex]) {
                groupedLapsByDriverIndex[lap.driverIndex] = [];
            }
            groupedLapsByDriverIndex[lap.driverIndex].push(lap);
        });

    const driverStats = [];

    // 🚦 Iterate through drivers and map them to grouped lap data
    for (let driverIndex = 0; driverIndex < drivers.length; driverIndex++) {
        const driver = drivers[driverIndex];
        const driverLaps = groupedLapsByDriverIndex[driverIndex] || [];
        const validDriverLaps = driverLaps.filter(lap => lap.isValidForBest);
        const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);
        // ✅ Sanitize SteamID
        const steamIdRaw = driver?.playerId || `Unknown_ID_${driverIndex}`;
        const steamId = sanitizeSteamId(steamIdRaw);

        // ✅ Get carModel for the driver (fallback to team carModel)
        // const driverCarModel = driver?.car?.carModel || carModel || 'Unknown Model';

        const avgLapTime = driverLaps.length > 0
            ? sanitizeNumeric(Math.round(driverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / driverLaps.length))
            : null;

        // ✅ Calculate Average Valid Lap Time
        const avgValidLapTime = validDriverLaps.length > 0
            ? sanitizeNumeric(Math.round(validDriverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / validDriverLaps.length))
            : null;

        // ✅ Calculate Fastest Valid Lap
        const fastestValidLap = validDriverLaps.length > 0
            ? sanitizeNumeric(Math.min(...validDriverLaps.map(lap => lap.laptime)))
            : null;


        const fastestPossibleTime = await calculateFastestPossibleTime(validDriverLaps);

        const driverDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

        // 🏁 Initialize static fastest splits
        let fastest_s1 = null;
        let fastest_s2 = null;
        let fastest_s3 = null;

        validDriverLaps.forEach(lap => {
            if (lap.splits) {
                lap.splits.forEach((splitTime, splitIndex) => {
                    if (splitIndex === 0 && (fastest_s1 === null || splitTime < fastest_s1)) {
                        fastest_s1 = splitTime;
                    }
                    if (splitIndex === 1 && (fastest_s2 === null || splitTime < fastest_s2)) {
                        fastest_s2 = splitTime;
                    }
                    if (splitIndex === 2 && (fastest_s3 === null || splitTime < fastest_s3)) {
                        fastest_s3 = splitTime;
                    }
                });
            }
        });

        // Extract lap count for the current driver
        const driverLapCount = raceLeaderboard.find(entry => entry.car?.carId === carId)?.timing?.lapCount || 0;

        const carInfo = await fetchCarDetails(car_model_id);

        const driverStat = {
            steamId, // ✅ Sanitized SteamID
            carId, // ✅ CarID for the driver
            carModel: carInfo.carModel, // ✅ CarID for the driver
            car_model_id,
            name: `${driver?.firstName || 'Unknown'} ${driver?.lastName || 'Driver'}`, // ✅ Driver Name
            cupCategory, // ✅ Cup Category for the driver
            finishingPosition, // ✅ Finishing Position
            leaderDelta, // ✅ Leader Delta
            driverIndex, // ✅ Driver Index
            totalLaps: driverLaps.length,
            validLaps: validDriverLaps.length,
            avgLapTime,
            avgValidLapTime,
            fastestValidLap,
            fastestPossibleTime,
            totalDriveTime: totalTimeFromLeaderboard,
            fastest_s1,
            fastest_s2,
            fastest_s3,
            carClass: carInfo.carClass, // ✅ CarClass for the driver
            driverDriveTime
        };

        driverStats.push(driverStat);

        // Insert driver stats into the database
        await insertDriverStatsIntoDatabase(sessionId, driverStat);
    }
}

// ✅ Insert Driver Stats into the Database
async function insertDriverStatsIntoDatabase(sessionId, driverStat) {
    try {
        // ✅ Add Driver to driver_info
        await db.query(
            `INSERT INTO driver_info (steam_id, real_name) 
     VALUES ($1, $2) ON CONFLICT (steam_id) DO NOTHING`,
            [driverStat.steamId, driverStat.name]
        );

        // ✅ Skip if no laps completed
        if (driverStat.totalLaps === 0) {
            // console.warn(`⏩ Skipping driver ${driverStat.steamId}: Did not finish the race (0 laps completed).`);
            return;
        }

        await db.query(
            `INSERT INTO driver_session_stats 
            (session_id, steam_id, car_model_id, car_model, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, cup_category, total_race_time, total_off_tracks, fastest_possible_s1, fastest_possible_s2, fastest_possible_s3, car_class, car_id, total_laps, total_valid_laps, drive_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
            [
                sessionId,
                driverStat.steamId,
                driverStat.car_model_id,
                driverStat.carModel,
                driverStat.finishingPosition,
                driverStat.leaderDelta,
                driverStat.fastestValidLap,
                driverStat.avgLapTime,
                driverStat.avgValidLapTime,
                driverStat.fastestPossibleTime,
                driverStat.cupCategory,
                driverStat.totalDriveTime,
                driverStat.totalLaps - driverStat.validLaps,
                driverStat.fastest_s1,
                driverStat.fastest_s2,
                driverStat.fastest_s3,
                driverStat.carClass,
                driverStat.carId,
                driverStat.totalLaps,
                driverStat.validLaps,
                driverStat.driverDriveTime
            ]
        );
        // console.log(`🆕 Driver stats inserted into database: ${driverStat.steamId}`);
    } catch (error) {
        console.error(`❌ Failed to insert driver stats into database:`, error.message);
    }
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
        ? sanitizeNumeric(bestSectors.reduce((a, b) => a + b, 0))
        : null;
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

            if (!sessionType || !trackId && sessionType === 'entrylist') {
                fs.renameSync(filePath, path.join(entrylistPath, file));
                console.log(`✅ Moved entry list successfully.`);
                // console.warn(`❌ SessionType or TrackID missing. Skipping session.`);
                continue;
            }

            const trackResult = await db.query(`SELECT track_id FROM track_info WHERE track_id = $1`, [trackId]);
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

            // Check for multiple drivers per carId before continuing
            let isDriverSwapRace = false;
            for (const carEntry of raceLeaderboard) {
                if (carEntry.car?.drivers && carEntry.car.drivers.length > 1) {
                    isDriverSwapRace = true;
                    console.log(`🔄 Driver swap race detected.Processing driver swap logic...`);
                    break;
                }
            }
            for (const carId of carIds) {
                const carEntry = raceLeaderboard.find(entry => entry.car?.carId === carId);
                if (!carEntry || !carEntry.car) {
                    console.warn(`⚠️ Invalid or missing car entry for CarID: ${carId}.Skipping.`);
                    continue;
                }

                if (isDriverSwapRace) {
                    // console.log(`🔄 Processing team event for CarID: ${carId}`);
                    await processTeamEvent(carId, carEntry, sessionId, sessionType, lapsData, raceLeaderboard);
                } else {
                    // console.log(`🚗 Processing solo event for CarID: ${carId}`);
                    await processSoloEvent(carId, carEntry, sessionId, sessionType, lapsData, raceLeaderboard);

                }
            }

            fs.renameSync(filePath, path.join(processedPath, file));
            console.log(`✅ Session ${file} processed successfully.`);

            await markTeamEvent(sessionId);
            await ensureDriversExist(raceLeaderboard);
            await refreshDriverTrackInfo();
            await refreshDriverCarTrackInfo();
            await refreshDriverInfo();
            await refreshCarInfo();
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