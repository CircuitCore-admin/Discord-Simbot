// Assuming carModels.js is already imported
const fs = require('fs');
const path = require('path');
const carModels = require('../data/carModels');

// ✅ Load JSON Data
const loadData = filePath => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        throw new Error(`❌ Failed to load JSON data from ${filePath}: ${error.message}`);
    }
};

// ✅ Function to Find Car Class by Model ID
function findCarClassByModel(carModelId) {
    for (const [carClass, models] of Object.entries(carModels)) {
        if (models[carModelId]) {
            return carClass;
        }
    }
    return 'UNKNOWN'; // Fallback if no match is found
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
// ✅ Format Lap Time
function formatLapTime(ms) {
    if (ms === 'N/A' || ms == null) return null;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.round(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

// ✅ Generate Class Leaderboards with Proper DNF Handling
function generateClassLeaderboards(sessionResult, sessionType) {
    const { leaderBoardLines } = sessionResult;

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

// ✅ Example Usage
try {
    const sessionResult = loadData('./results_cleaned/241216_195850_R(1)_clean.json').sessionResult;
    const sessionType = 'R'; // Adjust based on session type (FP, Q, R)

    const classLeaderboards = generateClassLeaderboards(sessionResult, sessionType);

    // Display leaderboards for each class
    Object.keys(classLeaderboards).forEach(carClass => {
        console.log(`🏎️ ${carClass} Class Leaderboard with Null Positions for DNF:`);
        console.table(classLeaderboards[carClass].map(entry => ({
            driver: entry.car?.drivers?.[0]?.firstName + ' ' + entry.car?.drivers?.[0]?.lastName,
            carModel: entry.car?.carModel,
            overallPosition: entry.overallPosition,
            classPosition: entry.classPosition,
            leaderDelta: entry.leaderDelta
        })));
    });
} catch (error) {
    console.error('❌ Error generating class leaderboards with DNF handling:', error.message);
}



// Example Usage
const sessionResult = loadData('./results_cleaned/241216_195850_R(1)_clean.json').sessionResult;
const classLeaderboards = generateClassLeaderboards(sessionResult);

// Display the GT3 class leaderboard
// console.log('GT3 Class Leaderboard:', classLeaderboards['GT3']);
