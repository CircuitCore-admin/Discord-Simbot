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

// ✅ Generate Class Leaderboards Using Natural Order
function generateClassLeaderboards(sessionResult) {
    const { leaderBoardLines } = sessionResult;

    if (!leaderBoardLines || leaderBoardLines.length === 0) {
        console.warn('No leaderboard data available.');
        return {};
    }

    const classLeaderboards = {};

    // Step 1: Map entries to their car class while preserving natural order
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
            overallPosition: index + 1, // Natural order in the race result
        });
    });

    // Step 2: Assign class-specific positions based on the natural order in each class
    Object.keys(classLeaderboards).forEach(carClass => {
        classLeaderboards[carClass].forEach((entry, index) => {
            entry.classPosition = index + 1; // Position within the class group
        });
    });

    return classLeaderboards;
}

// ✅ Example Usage
try {
    const sessionResult = loadData('./results_cleaned/241216_195850_R(1)_clean.json').sessionResult;
    const classLeaderboards = generateClassLeaderboards(sessionResult);

    // Display leaderboards for each class
    Object.keys(classLeaderboards).forEach(carClass => {
        console.log(`🏎️ ${carClass} Class Leaderboard:`);
        console.table(classLeaderboards[carClass].map(entry => ({
            driver: entry.car?.drivers?.[0]?.firstName + ' ' + entry.car?.drivers?.[0]?.lastName,
            carModel: entry.car?.carModel,
            overallPosition: entry.overallPosition,
            classPosition: entry.classPosition
        })));
    });
} catch (error) {
    console.error('❌ Error generating class leaderboards:', error.message);
}


// Example Usage
const sessionResult = loadData('./results_cleaned/241216_224343_R(4).json').sessionResult;
const classLeaderboards = generateClassLeaderboards(sessionResult);

// Display the GT3 class leaderboard
// console.log('GT3 Class Leaderboard:', classLeaderboards['GT3']);
