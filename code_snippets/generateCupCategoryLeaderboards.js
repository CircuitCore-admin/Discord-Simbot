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

// ✅ Generate Cup Category Leaderboards
function generateCupCategoryLeaderboards(sessionResult) {
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
            overallPosition: index + 1, // Natural order in race result
        });
    });

    // Step 2: Assign cup-specific positions based on natural order
    Object.keys(cupLeaderboards).forEach(cupCategory => {
        cupLeaderboards[cupCategory].forEach((entry, index) => {
            entry.cupPosition = index + 1; // Position within cupCategory
        });
    });

    return cupLeaderboards;
}

// ✅ Example Usage
try {
    const sessionResult = loadData('./results_cleaned/241216_224343_R(4).json').sessionResult;
    const cupLeaderboards = generateCupCategoryLeaderboards(sessionResult);

    // Display leaderboards for each cupCategory
    Object.keys(cupLeaderboards).forEach(cupCategory => {
        console.log(`🏆 Cup Category ${cupCategory} Leaderboard:`);
        console.table(cupLeaderboards[cupCategory].map(entry => ({
            driver: entry.car?.drivers?.[0]?.firstName + ' ' + entry.car?.drivers?.[0]?.lastName,
            carModel: entry.car?.carModel,
            overallPosition: entry.overallPosition,
            cupPosition: entry.cupPosition
        })));
    });
} catch (error) {
    console.error('❌ Error generating cup category leaderboards:', error.message);
}

const sessionResult = loadData('./results_cleaned/241216_224343_R(4).json').sessionResult;
generateCupCategoryLeaderboards(sessionResult);