const fs = require('fs');
const path = require('path');

// ✅ File Path
const filePath = path.join(__dirname, '240921_224837_R(2).json');

// ✅ Load JSON Data
function loadData(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`❌ Failed to load JSON fileContent: ${error.message}`);
        process.exit(1);
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
        ? bestSectors.reduce((a, b) => a + b, 0)
        : 'N/A';
}

// ✅ Calculate Driver and Team Stats
function calculateLapStats() {
    const fileContent = loadData(filePath);
    const raceleaderBoard = fileContent.sessionResult?.leaderBoardLines || [];

    const lapsData = fileContent.laps || [];
    const carIds = new Set(lapsData.map(lap => lap.carId));

    console.log('🚗 Calculating driver and team lap stats...\n');

    carIds.forEach(carId => {
        const carEntry = raceleaderBoard.find(entry => entry.car?.carId === carId);

        if (!carEntry?.car?.drivers) {
            console.warn(`⚠️ No drivers found for CarID: ${carId}`);
            return;
        }

        const drivers = carEntry.car.drivers;
        console.log(`🆔 Car ID: ${carId} - Team Size: ${drivers.length} driver(s)`);

        let teamTotalLaps = 0, teamValidLaps = 0, teamDriveTime = 0;
        let teamLapTimes = [], teamValidLapTimes = [], teamLapsForSplits = [];
        let teamFastestValidLap = Infinity;

        drivers.forEach((driver, driverIndex) => {
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

            const fastestPossibleTime = calculateFastestPossibleTime(validDriverLaps);

            const driverDriveTime = driverLaps.reduce((sum, lap) => sum + lap.laptime, 0);

            teamTotalLaps += driverLaps.length;
            teamValidLaps += validDriverLaps.length;
            teamLapTimes.push(...driverLaps.map(lap => lap.laptime));
            teamValidLapTimes.push(...validDriverLaps.map(lap => lap.laptime));
            teamLapsForSplits.push(...validDriverLaps);
            teamFastestValidLap = Math.min(teamFastestValidLap, fastestValidLap !== 'N/A' ? fastestValidLap : Infinity);
            teamDriveTime += driverDriveTime;

            console.log(`   👤 Driver ${driverIndex + 1}:`);
            console.log(`      - Name: ${driver?.firstName || 'Unknown'} ${driver?.lastName || 'Unknown'}`);
            console.log(`      - Total Laps: ${driverLaps.length}`);
            console.log(`      - Average Lap Time: ${avgLapTime}`);
            console.log(`      - Valid Laps: ${validDriverLaps.length}`);
            console.log(`      - Average Valid Lap Time: ${avgValidLapTime}`);
            console.log(`      - Fastest Lap Time: ${fastestValidLap}`);
            console.log(`      - Fastest Possible Time: ${fastestPossibleTime}`);
            console.log(`      - Total Drive Time: ${driverDriveTime}`);
            console.log('--------------------------------');
        });

        const avgTeamLapTime = teamLapTimes.length > 0
            ? Math.round(teamLapTimes.reduce((sum, lap) => sum + lap, 0) / teamLapTimes.length)
            : 'N/A';

        const avgTeamValidLapTime = teamValidLapTimes.length > 0
            ? Math.round(teamValidLapTimes.reduce((sum, lap) => sum + lap, 0) / teamValidLapTimes.length)
            : 'N/A';

        const fastestPossibleTeamTime = calculateFastestPossibleTime(teamLapsForSplits);

        console.log(`🏁 Team Stats for Car ID: ${carId}`);
        console.log(`   - Total Team Laps: ${teamTotalLaps}`);
        console.log(`   - Fastest Team Lap: ${teamFastestValidLap}`);
        console.log(`   - Fastest Possible Team Lap: ${fastestPossibleTeamTime}`);
        console.log(`   - Average Team Lap Time: ${avgTeamLapTime}`);
        console.log(`   - Average Valid Team Lap Time: ${avgTeamValidLapTime}`);
        console.log(`   - Total Team Drive Time: ${teamDriveTime}`);
        console.log('================================\n');
    });
}

// ✅ Run the Check
calculateLapStats();
