// Import required modules from Discord.js and Node.js
// SlashCommandBuilder: Define commands for Discord interactions
// EmbedBuilder: Create rich embed messages for Discord responses
// fs: File system module for reading data from files
// path: Module for handling file paths
// carModels: Map car model identifiers to human-readable names
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const carModels = require('../data/carModels');

// Helper function to format lap time from milliseconds into MM:SS:MS
// Handles cases where input is 'N/A' or null
const formatLapTime = ms => {
    if (ms === 'N/A' || ms == null) return 'N/A';
    const minutes = Math.floor(ms / 60000); // Extract minutes
    const seconds = Math.floor((ms % 60000) / 1000); // Extract seconds
    const milliseconds = Math.round(ms % 1000); // Round milliseconds
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
};

// Helper function to determine emoji based on position change
// 📈: Improved position, 📉: Lost position, ➖: No change
const getPositionChangeEmoji = (start, finish) => start > finish ? '📈' : start < finish ? '📉' : '➖';

// Helper function to load and parse JSON data from a file
// Throws an error if the file cannot be read or parsed
const loadData = filePath => {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch { throw new Error(`❌ Could not load data from ${filePath}`); }
};

// Helper function to find a driver in a leaderboard by their full name
// Matches the driver's first and last name against the provided driverName
const findDriverEntry = (leaderboard, driverName) => leaderboard.find(entry =>
    `${entry.car?.drivers?.[0]?.firstName} ${entry.car?.drivers?.[0]?.lastName}`.trim().toLowerCase() === driverName.toLowerCase()
);

// Define the command structure for 'driver_stats'
// Accepts a required string option: driver_name
module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver_stats')
        .setDescription('Get detailed stats for a specific driver')
        .addStringOption(option =>
            option.setName('driver_name')
                .setDescription('Name of the driver')
                .setRequired(true)
        ),

    // Main command execution function
    // Handles data retrieval, calculations, and embeds construction
    async execute(interaction) {
        // Extract driver name from user input
        const driverName = interaction.options.getString('driver_name');

        // Load race and qualifying data from JSON files
        const raceData = loadData(path.join(__dirname, '../data/241216_224343_R(1).json'));
        const qualyData = loadData(path.join(__dirname, '../data/241216_213338_Q(1).json'));

        // Extract leaderboards from loaded data
        const raceLeaderboard = raceData?.sessionResult?.leaderBoardLines || [];
        const qualyLeaderboard = qualyData?.sessionResult?.leaderBoardLines || [];

        // Find driver entries in race and qualifying leaderboards
        const driverRaceEntry = findDriverEntry(raceLeaderboard, driverName);
        const driverQualyEntry = findDriverEntry(qualyLeaderboard, driverName);

        // If driver not found in either leaderboard, reply with an error
        if (!driverRaceEntry || !driverQualyEntry) {
            return interaction.reply({
                content: `❌ Driver **${driverName}** not found in results.`,
                ephemeral: true,
            });
        }

        // Determine driver's starting and finishing positions
        const startPos = qualyLeaderboard.indexOf(driverQualyEntry) + 1;
        const finishPos = raceLeaderboard.indexOf(driverRaceEntry) + 1;
        const positionChangeEmoji = getPositionChangeEmoji(startPos, finishPos);

        // Retrieve car model, falling back to 'N/A' if undefined
        const carModel = carModels[driverRaceEntry.car?.carModel] || driverRaceEntry.car?.carModel || 'N/A';

        // Calculate driver's total time and leader interval
        const driverTotalTime = driverRaceEntry.timing?.totalTime || 0;
        const leaderTotalTime = raceLeaderboard[0]?.timing?.totalTime || 0;

        const leaderInterval = finishPos === 1 ? "00:00:000" :
            driverTotalTime > 0 && leaderTotalTime > 0
                ? `+${formatLapTime(driverTotalTime - leaderTotalTime)}` : 'N/A';

        // Filter laps belonging to the driver and validate them
        const driverLaps = (raceData?.laps || []).filter(lap => lap.carId === driverRaceEntry.car.carId);
        const validLaps = driverLaps.filter(lap => lap.isValidForBest).map(lap => lap.laptime);
        const invalidLaps = driverLaps.length - validLaps.length;

        // Calculate best sector times for the driver
        const bestSectors = [];
        driverLaps.forEach(lap => lap.splits?.forEach((sector, i) => {
            if (sector != null && (bestSectors[i] == null || sector < bestSectors[i])) bestSectors[i] = sector;
        }));

        // Calculate best possible time from sector times
        const bestPossibleTime = bestSectors.length ? formatLapTime(bestSectors.reduce((a, b) => a + b, 0)) : 'N/A';

        // Calculate average lap times
        const averageValidLapTime = validLaps.length
            ? formatLapTime(Math.round(validLaps.reduce((a, b) => a + b, 0) / validLaps.length))
            : 'N/A';
        const averageLapTime = driverLaps.length
            ? formatLapTime(Math.round(driverLaps.reduce((a, b) => a + b.laptime, 0) / driverLaps.length))
            : 'N/A';

        // Build driver statistics object
        const driverStats = {
            driver_name: `${driverRaceEntry.car.drivers[0]?.firstName} ${driverRaceEntry.car.drivers[0]?.lastName}`,
            car: carModel,
            fastest_lap: formatLapTime(driverRaceEntry.timing?.bestLap),
            lap_count: driverRaceEntry.timing?.lapCount || 'N/A',
            total_time: formatLapTime(driverTotalTime),
            leader_delta: leaderInterval,
            starting_position: `P${startPos}`,
            finishing_position: `P${finishPos} ${positionChangeEmoji}`,
            best_possible_time: bestPossibleTime,
            average_valid_lap_time: averageValidLapTime,
            average_lap_time: averageLapTime,
            off_tracks: invalidLaps,
        };

        // Build an embed with driver stats
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🏎️ Driver Stats: ${driverStats.driver_name}`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
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
                iconURL: interaction.guild.iconURL({ dynamic: true })
            })
            .setTimestamp();

        // Send the embed as a response
        await interaction.reply({ embeds: [embed] });
    },
};
