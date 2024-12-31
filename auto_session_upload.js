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

const { cleanJsonFilesInDirectory } = require('./json_cleaner');

// const resultsRawPath = path.join(__dirname, 'results'); // Raw JSON files
const resultsCleanedPath = path.join(__dirname, 'results_cleaned'); // Cleaned JSON files
// const processedPath = path.join(__dirname, 'processed');
const entrylistPath = path.join(__dirname, 'entrylists');

// ✅ Check if file has already been processed
async function isFileProcessed(fileName) {
    try {
        const result = await db.query(
            `SELECT COUNT(*) FROM session_info WHERE results_name = $1`,
            [fileName]
        );
        return result.rows[0].count > 0;
    } catch (error) {
        console.error(`❌ Error checking if file is processed: ${error.message}`);
        return false;
    }
}

// Directories
// ✅ Import the car class helper
const { getCarClass, getCarModel } = require('./helpers/carClassHelper');
const { log } = require('console');

// ✅ Clean JSON Files Before Processing
function cleanJsonFiles() {
    console.log('🧹 Cleaning JSON files...');
    cleanJsonFilesInDirectory(resultsRawPath, resultsCleanedPath);
    console.log('✅ JSON files cleaned and copied successfully.');
}

// ✅ Helper function to sanitize SteamID
function sanitizeSteamId(steamId) {
    return steamId ? steamId.replace(/\D/g, '') : null;
}

// ✅ Helper function to format lap time
const formatLapTime = ms => {
    if (ms === 'N/A' || ms == null || ms === 2147483647) return null; // Handle edge case
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
                    [steamId, Buffer.from(realName, 'utf8').toString('utf8')]
                );
                console.log(`🆕 Added new driver: ${steamId} (${realName})`);
            } else {
                console.log(`🔗 Found driver: ${steamId}`);
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

// ✅ Function to Find Car Class by Model ID
function findCarClassByModel(carModelId) {
    for (const [carClass, models] of Object.entries(carModels)) {
        if (models[carModelId]) {
            return carClass;
        }
    }
    return 'UNKNOWN'; // Fallback if no match is found
}

// ✅ Generate Cup Category Leaderboards with Leader Intervals
function generateCupCategoryLeaderboards(sessionResult, sessionType) {
    const { leaderBoardLines } = sessionResult;

    if (!leaderBoardLines || leaderBoardLines.length === 0) {
        console.warn('❌ No leaderboard data available.');
        return {};
    }

    const cupLeaderboards = {};

    // Step 1: Group entries by cupCategory while maintaining natural order
    leaderBoardLines.forEach((entry, index) => {
        const cupCategory = entry.car?.cupCategory ?? 'UNKNOWN';

        if (!cupLeaderboards[cupCategory]) {
            cupLeaderboards[cupCategory] = [];
        }

        cupLeaderboards[cupCategory].push({
            ...entry,
            overallPosition: index + 1, // Preserve natural order
        });
    });

    // Step 2: Assign cup-specific positions and calculate leader intervals
    Object.keys(cupLeaderboards).forEach(cupCategory => {
        const cupDrivers = cupLeaderboards[cupCategory];

        if (cupDrivers.length === 0) return;

        // Leader is the first driver in the cup category
        const leader = cupDrivers[0];
        const leaderLaps = leader.timing?.lapCount || 0;
        const leaderBestLap = leader.timing?.bestLap || 'N/A';
        const leaderTotalTime = leader.timing?.totalTime || 'N/A';

        cupDrivers.forEach((entry, index) => {
            entry.cupPosition = index + 1; // Position within cupCategory

            const driverTotalTime = entry.timing?.totalTime || 0;
            const driverLapCount = entry.timing?.lapCount || 0;
            const driverBestLap = entry.timing?.bestLap || null;

            // Check for invalid bestLap during FP and Q sessions
            if (sessionType === 'FP' || sessionType === 'Q') {
                if (driverBestLap === 2147483647) {
                    entry.timing.bestLap = null;
                }
            }
            const validDrivers = [];
            const dnfDrivers = [];
            if (driverLapCount > 0 && driverBestLap && driverTotalTime > 0) {
                validDrivers.push(entry);
            } else {
                entry.leaderDelta = 'DNF';
                entry.cupPosition = null; // Explicitly set to null
                entry.overallPosition = null; // Explicitly set to null
                dnfDrivers.push(entry);
            }

            let leaderDelta = null;

            if (driverLapCount === 0) {
                leaderDelta = null; // No completed laps
            } else if (sessionType === 'FP' || sessionType === 'Q') {
                if (driverBestLap && leaderBestLap) {
                    const timeDelta = driverBestLap - leaderBestLap;
                    leaderDelta = `+${formatLapTime(timeDelta)}`;
                } else {
                    leaderDelta = null;
                }
            } else if (sessionType === 'R') {
                if (driverLapCount < leaderLaps) {
                    const lapDifference = leaderLaps - driverLapCount;
                    leaderDelta = `+${lapDifference} lap${lapDifference > 1 ? 's' : ''}`;
                } else if (driverLapCount === leaderLaps && leaderTotalTime > 0 && driverTotalTime > 0) {
                    const timeDelta = driverTotalTime - leaderTotalTime;
                    leaderDelta = `+${formatLapTime(timeDelta)}`;
                } else {
                    leaderDelta = null;
                }
            }

            entry.leaderDelta = leaderDelta;
        });
    });

    return cupLeaderboards;
}

// ✅ Generate Class Leaderboards with Proper DNF Handling
function generateClassLeaderboards(sessionResult, sessionType) {
    const { leaderBoardLines } = sessionResult;
    // console.log(leaderBoardLines)
    if (!leaderBoardLines || leaderBoardLines.length === 0) {
        console.warn('❌ No leaderboard data available.');
        return {};
    }

    const classLeaderboards = {};

    // Step 1: Group entries by class
    leaderBoardLines.forEach((entry, index) => {
        const carModelId = entry.car?.carModel;
        if (!carModelId) {
            console.warn(`⚠️ Missing carModel for carId: ${entry.car?.carId}`);
            return;
        }

        const carClass = findCarClassByModel(carModelId);

        if (!classLeaderboards[carClass]) {
            classLeaderboards[carClass] = [];
        }

        classLeaderboards[carClass].push({
            ...entry,
            originalOrder: index + 1, // Preserve initial order before separation
        });
    });

    // Step 2: Handle valid and DNF drivers separately
    Object.keys(classLeaderboards).forEach(carClass => {
        let classDrivers = classLeaderboards[carClass];

        const validDrivers = [];
        const dnfDrivers = [];

        // Separate valid drivers from DNF
        classDrivers.forEach((entry) => {
            const driverLapCount = entry.timing?.lapCount || 0;
            const driverBestLap = entry.timing?.bestLap || null;
            const driverTotalTime = entry.timing?.totalTime || 0;

            // Check for invalid bestLap during FP and Q sessions
            if (sessionType === 'FP' || sessionType === 'Q') {
                if (driverBestLap === 2147483647) {
                    entry.timing.bestLap = null;
                }
            }

            if (driverLapCount > 0 && driverBestLap && driverTotalTime > 0) {
                validDrivers.push(entry);
            } else {
                entry.leaderDelta = 'DNF';
                entry.classPosition = null; // Explicitly set to null
                entry.overallPosition = null; // Explicitly set to null
                dnfDrivers.push(entry);
            }
        });

        // Step 3: Assign `classPosition` and `overallPosition` for valid drivers
        if (validDrivers.length > 0) {
            const leader = validDrivers[0];
            const leaderLaps = leader.timing?.lapCount || 0;
            const leaderBestLap = leader.timing?.bestLap || 'N/A';
            const leaderTotalTime = leader.timing?.totalTime || 'N/A';

            validDrivers.forEach((entry, index) => {
                entry.classPosition = index + 1; // Sequential for valid drivers
                entry.overallPosition = entry.originalOrder; // Retain race order

                const driverTotalTime = entry.timing?.totalTime || 0;
                const driverLapCount = entry.timing?.lapCount || 0;
                const driverBestLap = entry.timing?.bestLap || null;

                let leaderDelta = null;

                if (sessionType === 'FP' || sessionType === 'Q') {
                    if (driverBestLap && leaderBestLap) {
                        const timeDelta = driverBestLap - leaderBestLap;
                        leaderDelta = `+${formatLapTime(timeDelta)}`;
                    } else {
                        leaderDelta = 'N/A';
                    }
                } else if (sessionType === 'R') {
                    if (driverLapCount < leaderLaps) {
                        const lapDifference = leaderLaps - driverLapCount;
                        leaderDelta = `+${lapDifference} lap${lapDifference > 1 ? 's' : ''}`;
                    } else if (driverLapCount === leaderLaps && leaderTotalTime > 0 && driverTotalTime > 0) {
                        const timeDelta = driverTotalTime - leaderTotalTime;
                        leaderDelta = `+${formatLapTime(timeDelta)}`;
                    } else {
                        leaderDelta = 'N/A';
                    }
                }

                entry.leaderDelta = leaderDelta;
            });
        }

        // Step 4: Set `overallPosition` and `classPosition` for DNF drivers
        dnfDrivers.forEach((entry) => {
            entry.classPosition = null; // No class position
            entry.overallPosition = null; // No overall position
        });

        // Step 5: Merge valid and DNF drivers
        classLeaderboards[carClass] = [...validDrivers, ...dnfDrivers];
    });

    return classLeaderboards;
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

    const driverTotalTime = carEntry.timing?.totalTime || 0;
    const driverLapCount = carEntry.timing?.lapCount || 0;
    const hasCompletedLaps = driverLapCount > 0;
    const leaderLapCount = raceLeaderboard[0]?.timing?.lapCount || 0;
    const driverFastestLap = carEntry.timing?.bestLap || null;

    let classPosition = null;
    let classDelta = null;

    // Step 1: Generate Class Leaderboards
    const classLeaderboards = generateClassLeaderboards({ leaderBoardLines: raceLeaderboard }, sessionType);

    // Step 2: Find the class position and delta for the current car
    Object.keys(classLeaderboards).forEach(carClass => {
        classLeaderboards[carClass].forEach(entry => {
            if (entry.car?.carId === carId) {
                classPosition = entry.classPosition;
                classDelta = entry.leaderDelta;
            }
        });
    });
    const classInformation = {
        carId,
        classPosition,
        classDelta
    }

    let cupPosition = null;
    let cupDelta = null;

    // Step 1: Generate Cup Category Leaderboards
    const cupLeaderboards = generateCupCategoryLeaderboards({ leaderBoardLines: raceLeaderboard }, sessionType);

    // Step 2: Find the cup position and delta for the current car
    Object.keys(cupLeaderboards).forEach(cupCategory => {
        cupLeaderboards[cupCategory].forEach(entry => {
            if (entry.car?.carId === carId) {
                cupPosition = entry.cupPosition;
                cupDelta = entry.leaderDelta;
            }
        });
    });

    const cupInformation = {
        carId,
        cupPosition,
        cupDelta
    };

    let leaderDelta = null;
    if (!hasCompletedLaps) {
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
            const lapDifference = leaderLaps - driverLapCount;
            leaderDelta = `+${lapDifference} lap${lapDifference > 1 ? 's' : ''}`;
        } else if (driverLapCount === leaderLaps && leaderTotalTime > 0 && driverTotalTime > 0) {
            const timeDelta = driverTotalTime - leaderTotalTime;
            leaderDelta = `+${formatLapTime(timeDelta)}`;
        } else {
            leaderDelta = null;
        }
    }

    const leaderInfo = {
        leaderLaps,
        leaderBestLap,
        leaderTotalTime
    };

    const totalTimeFromLeaderboard = raceLeaderboard.find(entry => entry.car?.carId === carId)?.timing?.totalTime || null;
    const raceNumber = carEntry.car.raceNumber || 'N/A';

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

    for (let driverIndex = 0; driverIndex < drivers.length; driverIndex++) {
        const driver = drivers[driverIndex];
        const driverLaps = groupedLapsByDriverIndex[driverIndex] || [];
        const validDriverLaps = driverLaps.filter(lap => lap.isValidForBest);
        const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);

        // Check for invalid bestLap during FP and Q sessions
        const driverBestLap = carEntry.timing?.bestLap || null;
        if (sessionType === 'FP' || sessionType === 'Q') {
            if (driverBestLap === 2147483647) {
                carEntry.timing.bestLap = null;
            }
        }

        const steamIdRaw = driver?.playerId || `Unknown_ID_${driverIndex}`;
        const steamId = sanitizeSteamId(steamIdRaw);

        const avgLapTime = driverLaps.length > 0
            ? sanitizeNumeric(Math.round(driverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / driverLaps.length))
            : null;

        const avgValidLapTime = validDriverLaps.length > 0
            ? sanitizeNumeric(Math.round(validDriverLaps.reduce((sum, lap) => sum + lap.laptime, 0) / validDriverLaps.length))
            : null;

        const fastestValidLap = validDriverLaps.length > 0
            ? sanitizeNumeric(Math.min(...validDriverLaps.map(lap => lap.laptime)))
            : null;

        const fastestPossibleTime = calculateFastestPossibleTime(validDriverLaps);

        const driverDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

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

        const driverLapCount = raceLeaderboard.find(entry => entry.car?.carId === carId)?.timing?.lapCount || 0;

        const carInfo = await fetchCarDetails(car_model_id);

        const driverStat = {
            steamId,
            carId,
            carModel: carInfo.carModel,
            car_model_id,
            name: `${driver?.firstName || 'Unknown'} ${driver?.lastName || 'Driver'}`,
            cupCategory,
            finishingPosition,
            leaderDelta,
            driverIndex,
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
            carClass: carInfo.carClass,
            driverDriveTime,
            classPosition: classInformation.classPosition,
            classDelta: classInformation.classDelta,
            cupPosition: cupInformation.cupPosition,
            cupDelta: cupInformation.cupDelta,
            raceNumber
        };

        driverStats.push(driverStat);

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

    const avgTeamLapTime = teamLapTimes.length > 0
        ? sanitizeNumeric(Math.round(teamLapTimes.reduce((sum, lap) => sum + lap, 0) / teamLapTimes.length))
        : null;

    const avgTeamValidLapTime = teamValidLapTimes.length > 0
        ? sanitizeNumeric(Math.round(teamValidLapTimes.reduce((sum, lap) => sum + lap, 0) / teamValidLapTimes.length))
        : null;

    const fastestPossibleTeamTime = calculateFastestPossibleTime(teamLapsForSplits);
    const car_class = findCarClassByModel(car_model_id);
    const teamStats = {
        carId,
        car_model_id,
        car_class,
        cupCategory,
        finishingPosition,
        leaderDelta,
        classPosition: classInformation.classPosition,
        classDelta: classInformation.classDelta,
        cupPosition: cupInformation.cupPosition,
        cupDelta: cupInformation.cupDelta,
        teamTotalLaps,
        teamValidLaps,
        teamFastestValidLap,
        fastestPossibleTeamTime,
        avgTeamLapTime,
        avgTeamValidLapTime,
        teamDriveTime,
        totalTime: totalTimeFromLeaderboard,
        driverCount: driverStats.length,
        raceNumber,
        drivers: driverStats
    };

    await insertTeamStatsIntoDatabase(sessionId, teamStats, driverStats);
}

// ✅ Insert Team Stats into the Database
async function insertTeamStatsIntoDatabase(sessionId, teamStats, driverStats) {
    try {
        for (const driverStat of driverStats) {
            // Check if steam_id is valid
            if (!driverStat.steamId) {
                console.warn(`⚠️ Invalid SteamID for driver: ${driverStat.name}. Skipping insertion.`);
                continue;
            }

            // ✅ Add Driver to driver_info
            await db.query(
                `INSERT INTO driver_info (steam_id, real_name) 
         VALUES ($1, $2) ON CONFLICT (steam_id) DO NOTHING`,
                [driverStat.steamId, Buffer.from(driverStat.name, 'utf8').toString('utf8')]
            );
        }

        // ✅ Insert team stats
        await db.query(
            `INSERT INTO team_session_stats (
                session_id,
                car_id,
                car_model_id,
                car_class,
                cup_category,
                finishing_position,
                leader_delta,
                class_position,
                class_delta,
                category_position,
                category_delta,
                total_laps,
                total_valid_laps,
                fastest_valid_lap,
                fastest_possible_team_time,
                avg_lap_time,
                avg_valid_lap_time,
                drive_time,
                total_time,
                drivers_count,
                race_number,
                drivers
            )
            VALUES (
                $1, -- session_id
                $2, -- car_id
                $3, -- car_model_id
                $4, -- car_class
                $5, -- cup_category
                $6, -- finishing_position
                $7, -- leader_delta
                $8, -- class_position
                $9, -- class_delta
                $10, -- category_position
                $11, -- category_delta
                $12, -- total_laps
                $13, -- total_valid_laps
                $14, -- fastest_valid_lap
                $15, -- fastest_possible_team_time
                $16, -- avg_lap_time
                $17, -- avg_valid_lap_time
                $18, -- drive_time
                $19, -- total_time
                $20, -- drivers count
                $21, -- race number
                $22::JSONB -- drivers (JSONB format)
            )`,
            [
                sessionId,
                teamStats.carId,
                teamStats.car_model_id,
                teamStats.car_class,
                teamStats.cupCategory,
                teamStats.finishingPosition,
                teamStats.leaderDelta,
                teamStats.classPosition,
                teamStats.classDelta,
                teamStats.cupPosition,
                teamStats.cupDelta,
                teamStats.teamTotalLaps,
                teamStats.teamValidLaps,
                teamStats.teamFastestValidLap,
                teamStats.fastestPossibleTeamTime,
                teamStats.avgTeamLapTime,
                teamStats.avgTeamValidLapTime,
                teamStats.teamDriveTime,
                teamStats.totalTime,
                teamStats.drivers.length,
                teamStats.raceNumber,
                JSON.stringify(teamStats.drivers)
            ]
        );
        console.log(`🆕 Team stats inserted into database for car ${teamStats.carId}`);
    } catch (error) {
        console.error(`❌ Failed to insert team stats into database:`, error.message);
    }
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

    let classPosition = null;
    let classDelta = null;

    // Step 1: Generate Class Leaderboards
    const classLeaderboards = generateClassLeaderboards({ leaderBoardLines: raceLeaderboard }, sessionType);

    // Step 2: Find the class position and delta for the current car
    Object.keys(classLeaderboards).forEach(carClass => {
        classLeaderboards[carClass].forEach(entry => {
            if (entry.car?.carId === carId) {
                classPosition = entry.classPosition;
                classDelta = entry.leaderDelta;
            }
        });
    });
    const classInformation = {
        carId,
        classPosition,
        classDelta
    }

    let cupPosition = null;
    let cupDelta = null;

    // Step 1: Generate Cup Category Leaderboards
    const cupLeaderboards = generateCupCategoryLeaderboards({ leaderBoardLines: raceLeaderboard }, sessionType);

    // Step 2: Find the cup position and delta for the current car
    Object.keys(cupLeaderboards).forEach(cupCategory => {
        cupLeaderboards[cupCategory].forEach(entry => {
            if (entry.car?.carId === carId) {
                cupPosition = entry.cupPosition;
                cupDelta = entry.leaderDelta;
            }
        });
    });

    const cupInformation = {
        carId,
        cupPosition,
        cupDelta
    };

    if (!hasCompletedLaps) {
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
            const lapDifference = leaderLaps - driverLapCount;
            leaderDelta = `+${lapDifference} lap${lapDifference > 1 ? 's' : ''}`;
        } else if (driverLapCount === leaderLaps && leaderTotalTime > 0 && driverTotalTime > 0) {
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

        // Check for invalid bestLap during FP and Q sessions
        const driverBestLap = carEntry.timing?.bestLap || null;
        if (sessionType === 'FP' || sessionType === 'Q') {
            if (driverBestLap === 2147483647) {
                carEntry.timing.bestLap = null;
            }
        }

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
        const raceNumber = carEntry.car.raceNumber || 'N/A';
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
            driverDriveTime,
            classPosition: classInformation.classPosition,
            classDelta: classInformation.classDelta,
            cupPosition: cupInformation.cupPosition,
            cupDelta: cupInformation.cupDelta,
            raceNumber
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
            [driverStat.steamId, Buffer.from(driverStat.name, 'utf8').toString('utf8')]
        );

        // ✅ Skip if no laps completed
        if (driverStat.totalLaps === 0) {
            // console.warn(`⏩ Skipping driver ${driverStat.steamId}: Did not finish the race (0 laps completed).`);
            return;
        }

        await db.query(
            `INSERT INTO driver_session_stats 
             (session_id, steam_id, car_model_id, car_model, finishing_position, leader_delta, fastest_lap, average_lap, average_valid_lap, fastest_possible_lap, cup_category, total_race_time, total_off_tracks, fastest_possible_s1, fastest_possible_s2, fastest_possible_s3, car_class, car_id, total_laps, total_valid_laps, drive_time, class_position, class_delta, category_position, category_delta, race_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
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
                driverStat.driverDriveTime,
                driverStat.classPosition,
                driverStat.classDelta,
                driverStat.cupPosition,
                driverStat.cupDelta,
                driverStat.raceNumber
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
async function processSessionFilesFromDirectories(directories) {
    console.log('🚀 Starting session file processing...');

    try {
        for (const dir of directories) {
            // Ensure the directory exists before processing
            if (!fs.existsSync(dir)) {
                console.error(`❌ Directory does not exist: ${dir}`);
                continue;
            }

            console.log(`📂 Processing directory: ${dir}`);
            cleanJsonFilesInDirectory(dir, resultsCleanedPath);

            const files = fs.readdirSync(resultsCleanedPath).filter(file => file.endsWith('-c.json') && !file.endsWith('-c-p.json'));

            if (files.length === 0) {
                console.log('📂 No new session files found. Waiting for next run...');
                continue;
            }

            for (const file of files) {
                await new Promise(resolve => setTimeout(resolve, 70));

                // Check if the file has already been processed
                if (await isFileProcessed(file)) {
                    console.log(`⏩ Skipping already processed file: ${file}`);
                    continue;
                }

                const filePath = path.join(resultsCleanedPath, file);
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
                        console.log(`🔄 Driver swap race detected. Processing driver swap logic...`);
                        break;
                    }
                }
                for (const carId of carIds) {
                    const carEntry = raceLeaderboard.find(entry => entry.car?.carId === carId);
                    if (!carEntry || !carEntry.car) {
                        console.warn(`⚠️ Invalid or missing car entry for CarID: ${carId}. Skipping.`);
                        continue;
                    }

                    if (isDriverSwapRace) {
                        console.log(`🔄 Processing team event for CarID: ${carId}`);
                        await processTeamEvent(carId, carEntry, sessionId, sessionType, lapsData, raceLeaderboard);
                    } else {
                        console.log(`🚗 Processing solo event for CarID: ${carId}`);
                        await processSoloEvent(carId, carEntry, sessionId, sessionType, lapsData, raceLeaderboard);
                    }
                }

                console.log(`✅ Session ${file} processed successfully.`);
                const newFilePath = path.join(resultsCleanedPath, file.replace('-c.json', '-c-p.json'));
                fs.renameSync(filePath, newFilePath);

                await markTeamEvent(sessionId);
                
                await ensureDriversExist(raceLeaderboard);
                await new Promise(resolve => setTimeout(resolve, 70));
                await refreshDriverTrackInfo();
                await new Promise(resolve => setTimeout(resolve, 70));
                // await refreshDriverCarTrackInfo();
                await refreshCarInfo();
                await new Promise(resolve => setTimeout(resolve, 70));
                await refreshDriverInfo();
            }
        }
    } catch (error) {
        console.error('❌ Failed to process session files:', error.message);
    }
}

// Periodic check for new files
const directories = [
    'C:/Users/otten/Downloads/wetransfer_results-rar_2024-12-28_1942/results',
    'C:/Users/otten/Downloads/wetransfer_results-rar_2024-12-28_1942/results-2',
    'C:/Users/otten/Downloads/wetransfer_results-rar_2024-12-28_1942/results-3',
    'C:/Users/otten/Downloads/wetransfer_results-rar_2024-12-28_1942/results-solo',
    'C:/Users/otten/Downloads/wetransfer_results-rar_2024-12-28_1942/results-practice',
    'C:/Users/otten/Downloads/wetransfer_results-rar_2024-12-28_1942/results-enduro'
];

// setInterval(() => processSessionFilesFromDirectories(directories), 5 * 60 * 1000);

// Initial run
processSessionFilesFromDirectories(directories);

// const directories = [
//     'F:/Event Management/Online/Server 1 WGC-1 250 connections/server/results',
//     'F:/Event Management/Online/Server 2 WGC-2 250 connections/server/results',
//     'F:/Event Management/Online/Server 3 WGC-3 250 connections/server/results',
//     'F:/Event Management/Online/Server 4 WGC-solo 250 connections/server/results',
//     'F:/Event Management/Online/Server 9 WGC-enduro 250 connections/server/results',
//     'F:/Event Management/Online/Server 10 WGC-practice 55 105 connections/server/results'
//     // Add more directories as needed
// ];