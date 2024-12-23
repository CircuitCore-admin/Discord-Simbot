const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const carModels = require('../data/carModels');

// Helper function to format lap times (from ms to MM:SS:MS)
function formatLapTime(ms) {
    if (ms === 'N/A' || ms == null) return 'N/A';

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

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

        // Build driver stats
        const driverStats = {
            driver_name: `${driverRaceEntry.car.drivers[0]?.firstName} ${driverRaceEntry.car.drivers[0]?.lastName}`,
            car: displayedCarModel,
            fastest_lap: formatLapTime(driverRaceEntry.timing?.bestLap),
            lap_count: driverRaceEntry.timing?.lapCount || 'N/A',
            total_time: formatLapTime(driverRaceEntry.timing?.totalTime),
            starting_position: `P${startPos}`,
            finishing_position: `P${finishPos} ${positionChangeEmoji}`
        };

        // Filter laps and calculate average lap times
        const laps = raceData?.laps || [];
        const driverLaps = laps.filter(lap => lap.carId === driverRaceEntry.car.carId);

        const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);
        const invalidLaps = driverLaps.filter(lap => !lap.isValidForBest).length;

        // Calculate average valid lap time
        const averageValidLapTimeInMs = validLaps.length > 0
            ? (validLaps.reduce((a, b) => a + b, 0) / validLaps.length)
            : null;

        // Calculate overall average lap time
        const allLaps = driverLaps.map(lap => lap.laptime);
        const averageLapTimeInMs = allLaps.length > 0
            ? (allLaps.reduce((a, b) => a + b, 0) / allLaps.length)
            : null;

        // Format the times
        driverStats.average_valid_lap_time = averageValidLapTimeInMs
            ? formatLapTime(Math.round(averageValidLapTimeInMs))
            : 'N/A';

        driverStats.average_lap_time = averageLapTimeInMs
            ? formatLapTime(Math.round(averageLapTimeInMs))
            : 'N/A';

        driverStats.off_tracks = invalidLaps;

        // Build the embed response
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🏎️ Driver Stats: ${driverStats.driver_name}`)
            .addFields(
                { name: '📊 Positions', value: `${driverStats.starting_position} > ${driverStats.finishing_position}`, inline: true },
                { name: '⚡ Fastest Lap', value: driverStats.fastest_lap, inline: true },
                { name: '⏱️ Average Lap Time', value: driverStats.average_lap_time, inline: true },
                { name: '⏱️ Average Valid Lap Time', value: driverStats.average_valid_lap_time, inline: true },
                { name: '🏁 Total Laps', value: driverStats.lap_count.toString(), inline: true },
                { name: '🚩 Total Off-Tracks', value: driverStats.off_tracks.toString(), inline: true },
                { name: '🏎️ Car', value: driverStats.car, inline: false }
            )
            .setFooter({ text: 'ACC Race Stats', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

        await interaction.reply({ embeds: [embed] });
    },
};
