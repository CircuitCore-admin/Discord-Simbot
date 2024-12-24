const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const carModels = require('../data/carModels');

// Helper function to format lap times (from ms to MM:SS:MS)
function formatLapTime(ms) {
    if (ms === 'N/A' || ms == null) return 'N/A';

    const minutes = Math.floor(ms / 60000); // 1 minute = 60000 ms
    const seconds = Math.floor((ms % 60000) / 1000); // Remaining seconds
    const milliseconds = ms % 1000; // Remaining milliseconds

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
}

// Helper function to determine position change emoji
function getPositionChangeEmoji(startPos, finishPos) {
    if (startPos > finishPos) return '📈'; // Gained positions
    if (startPos < finishPos) return '📉'; // Lost positions
    return '➖'; // No change
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver_stats')
        .setDescription('Get detailed stats for a specific driver')
        .addStringOption(option =>
            option.setName('driver_name')
                .setDescription('Name of the driver')
                .setRequired(true)),

    async execute(interaction) {
        const driverName = interaction.options.getString('driver_name');
        console.log('Received driver_name:', driverName);

        const raceFilePath = path.join(__dirname, '../data/241216_224343_R(1).json');
        const qualyFilePath = path.join(__dirname, '../data/241216_213338_Q(1).json');

        let raceData, qualyData;

        // Load race data
        try {
            const raceFile = fs.readFileSync(raceFilePath, 'utf-8');
            raceData = JSON.parse(raceFile);
        } catch (error) {
            console.error('❌ Error reading race results file:', error);
            return interaction.reply({
                content: '❌ Could not load race results data.',
                ephemeral: true,
            });
        }

        // Load qualifying data
        try {
            const qualyFile = fs.readFileSync(qualyFilePath, 'utf-8');
            qualyData = JSON.parse(qualyFile);
        } catch (error) {
            console.error('❌ Error reading qualification results file:', error);
            return interaction.reply({
                content: '❌ Could not load qualification results data.',
                ephemeral: true,
            });
        }

        // Find the driver in race results
        const raceLeaderboard = raceData?.sessionResult?.leaderBoardLines || [];
        const driverRaceEntry = raceLeaderboard.find(entry => {
            const driver = entry.car?.drivers?.[0];
            return `${driver?.firstName} ${driver?.lastName}`.trim().toLowerCase() === driverName.toLowerCase();
        });

        if (!driverRaceEntry) {
            console.log(`Driver ${driverName} not found in race results.`);
            return interaction.reply({
                content: `❌ Driver **${driverName}** not found in race results.`,
                ephemeral: true,
            });
        }

        // Find the driver in qualification results
        const qualyLeaderboard = qualyData?.sessionResult?.leaderBoardLines || [];
        const driverQualyEntry = qualyLeaderboard.find(entry => {
            const driver = entry.car?.drivers?.[0];
            return `${driver?.firstName} ${driver?.lastName}`.trim().toLowerCase() === driverName.toLowerCase();
        });

        if (!driverQualyEntry) {
            console.log(`Driver ${driverName} not found in qualification results.`);
            return interaction.reply({
                content: `❌ Driver **${driverName}** not found in qualification results.`,
                ephemeral: true,
            });
        }

        // Extract starting and finishing positions
        const startPos = qualyLeaderboard.indexOf(driverQualyEntry) + 1;
        const finishPos = raceLeaderboard.indexOf(driverRaceEntry) + 1;
        const positionChangeEmoji = getPositionChangeEmoji(startPos, finishPos);

        // Extract car model
        const carModel = driverRaceEntry.car?.carModel || 'N/A';
        const displayedCarModel = carModels[carModel] || carModel;

        // Extract driver's total time
        const driverTotalTime = driverRaceEntry.timing?.totalTime || 0;

        // Extract leader's total time (P1)
        const leaderEntry = raceLeaderboard[0];
        const leaderTotalTime = leaderEntry?.timing?.totalTime || 0;

        // Calculate Leader Interval
        let leaderInterval = 'N/A';
        if (finishPos === 1) {
            leaderInterval = "00:00:000"; // If P1, show 00:00:000 time
        } else if (driverTotalTime > 0 && leaderTotalTime > 0) {
            const interval = driverTotalTime - leaderTotalTime;
            leaderInterval = "+" + formatLapTime(interval);
        }

        // Build driver stats
        const driverStats = {
            driver_name: `${driverRaceEntry.car.drivers[0]?.firstName} ${driverRaceEntry.car.drivers[0]?.lastName}`,
            car: displayedCarModel,
            fastest_lap: (driverRaceEntry.timing?.bestLap && driverRaceEntry.timing.bestLap > 0 && driverRaceEntry.timing.bestLap !== 2147483647)
                ? formatLapTime(driverRaceEntry.timing.bestLap)
                : 'N/A',
            lap_count: driverRaceEntry.timing?.lapCount || 'N/A',
            total_time: driverRaceEntry.timing?.totalTime
                ? formatLapTime(driverRaceEntry.timing.totalTime)
                : 'N/A',
            leader_delta: leaderInterval,
            starting_position: `P${startPos}`,
            finishing_position: `P${finishPos} ${positionChangeEmoji}`
        };

        // Filter laps and calculate average lap times
        const laps = raceData?.laps || [];
        const driverLaps = laps.filter(lap => lap.carId === driverRaceEntry.car.carId);

        const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);
        const invalidLaps = driverLaps.filter(lap => !lap.isValidForBest).length;

        // Calculate Best Possible Time from fastest sectors
        let bestSectors = [];
        driverLaps.forEach((lap) => {
            if (lap.isValidForBest && lap.splits) {
                lap.splits.forEach((sectorTime, index) => {
                    if (bestSectors[index] === undefined || (sectorTime != null && sectorTime < bestSectors[index])) {
                        bestSectors[index] = sectorTime;
                    }
                });
            }
        });

        const bestPossibleTimeInMs = bestSectors.length > 0 && bestSectors.every(sector => sector !== null && sector !== undefined)
            ? bestSectors.reduce((total, sector) => total + sector, 0)
            : null;

        driverStats.best_possible_time = bestPossibleTimeInMs
            ? formatLapTime(Math.round(bestPossibleTimeInMs))
            : 'N/A';

        driverStats.average_valid_lap_time = validLaps.length
            ? formatLapTime(Math.round(validLaps.reduce((a, b) => a + b, 0) / validLaps.length))
            : 'N/A';

        driverStats.average_lap_time = driverLaps.length
            ? formatLapTime(Math.round(driverLaps.reduce((a, b) => a + b.laptime, 0) / driverLaps.length))
            : 'N/A';

        driverStats.off_tracks = invalidLaps;

        // Build the embed response
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🏎️ Driver Stats: ${driverStats.driver_name}`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true })) // Add server icon as thumbnail
            .addFields(
                { name: '🏎️ Car', value: driverStats.car, inline: true },
                { name: '📊 Positions', value: `${driverStats.starting_position} > ${driverStats.finishing_position}`, inline: true },
                { name: '🏆 Leader Delta', value: driverStats.leader_delta, inline: true },
                { name: '⚡ Fastest Lap', value: driverStats.fastest_lap, inline: true },
                { name: '⏱️ Average Lap', value: driverStats.average_lap_time, inline: true },
                { name: '⏱️ Average Valid Lap', value: driverStats.average_valid_lap_time, inline: true },
                { name: '🏁 Best Possible Time', value: driverStats.best_possible_time, inline: true },
                { name: '🏁 Total Laps', value: driverStats.lap_count.toString(), inline: true },
                { name: '🚩 Total Off-Tracks', value: driverStats.off_tracks.toString(), inline: true }
            )
            .setFooter({
                text: `Server: ${interaction.guild.name}`,
                iconURL: interaction.guild.iconURL({ dynamic: true }) // Add server icon in the footer
            })
            .setTimestamp(); // Add current timestamp

        await interaction.reply({ embeds: [embed] });
    },
};
