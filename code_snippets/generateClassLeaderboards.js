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

// ✅ Generate Class Leaderboards with Leader Delta
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
            overallPosition: index + 1, // Preserve natural order
        });
    });

    // Step 2: Assign class-specific positions and calculate leader intervals
    Object.keys(classLeaderboards).forEach(carClass => {
        const classDrivers = classLeaderboards[carClass];

        if (classDrivers.length === 0) return;

        // Leader is the first driver in the class
        const leader = classDrivers[0];
        const leaderLaps = leader.timing?.lapCount || 0;
        const leaderBestLap = leader.timing?.bestLap || 'N/A';
        const leaderTotalTime = leader.timing?.totalTime || 'N/A';

        classDrivers.forEach((entry, index) => {
            entry.classPosition = index + 1; // Position within class

            const driverTotalTime = entry.timing?.totalTime || 0;
            const driverLapCount = entry.timing?.lapCount || 0;
            const driverBestLap = entry.timing?.bestLap || null;

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

    return classLeaderboards;
}

// ✅ Example Usage
try {
    const sessionResult = loadData('./results_cleaned/241216_195850_R(1)_clean.json').sessionResult;
    const sessionType = 'R'; // Adjust based on session type (FP, Q, R)

    const classLeaderboards = generateClassLeaderboards(sessionResult, sessionType);

    // Display leaderboards for each class
    Object.keys(classLeaderboards).forEach(carClass => {
        console.log(`🏎️ ${carClass} Class Leaderboard with Leader Intervals:`);
        console.table(classLeaderboards[carClass].map(entry => ({
            driver: entry.car?.drivers?.[0]?.firstName + ' ' + entry.car?.drivers?.[0]?.lastName,
            carModel: entry.car?.carModel,
            overallPosition: entry.overallPosition,
            classPosition: entry.classPosition,
            leaderDelta: entry.leaderDelta
        })));
    });
} catch (error) {
    console.error('❌ Error generating class leaderboards with leader intervals:', error.message);
}



// Example Usage
const sessionResult = loadData('./results_cleaned/241216_224343_R(4).json').sessionResult;
const classLeaderboards = generateClassLeaderboards(sessionResult);

// Display the GT3 class leaderboard
// console.log('GT3 Class Leaderboard:', classLeaderboards['GT3']);
