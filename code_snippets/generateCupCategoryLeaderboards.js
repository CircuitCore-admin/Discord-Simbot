// Assuming carModels.js is already imported
const fs = require('fs');
const path = require('path');

// ✅ Load JSON Data
const loadData = filePath => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        throw new Error(`❌ Failed to load JSON data from ${filePath}: ${error.message}`);
    }
};

// ✅ Format Lap Time
function formatLapTime(ms) {
    if (ms === 'N/A' || ms == null) return null;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.round(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
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

// ✅ Example Usage
try {
    const sessionResult = loadData('./results_cleaned/241216_224343_R(4).json').sessionResult;
    const sessionType = 'R'; // Adjust based on session type (FP, Q, R)

    const cupLeaderboards = generateCupCategoryLeaderboards(sessionResult, sessionType);

    // Display leaderboards for each cupCategory
    Object.keys(cupLeaderboards).forEach(cupCategory => {
        console.log(`🏆 Cup Category ${cupCategory} Leaderboard with Leader Intervals:`);
        console.table(cupLeaderboards[cupCategory].map(entry => ({
            driver: entry.car?.drivers?.[0]?.firstName + ' ' + entry.car?.drivers?.[0]?.lastName,
            carModel: entry.car?.carModel,
            overallPosition: entry.overallPosition,
            cupPosition: entry.cupPosition,
            leaderDelta: entry.leaderDelta
        })));
    });
} catch (error) {
    console.error('❌ Error generating cup category leaderboards with leader intervals:', error.message);
}


const sessionResult = loadData('./results_cleaned/241216_224343_R(4).json').sessionResult;
generateCupCategoryLeaderboards(sessionResult);