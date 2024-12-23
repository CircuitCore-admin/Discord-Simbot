// const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// const fs = require('fs');
// const path = require('path');

// // Helper function to format lap times (from ms to MM:SS:MS)
// function formatLapTime(ms) {
//     if (ms === 'N/A' || ms == null) return 'N/A';

//     const minutes = Math.floor(ms / 60000); // 1 minute = 60000 ms
//     const seconds = Math.floor((ms % 60000) / 1000); // Remaining seconds
//     const milliseconds = ms % 1000; // Remaining milliseconds

//     return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
// }

// module.exports = {
//     data: new SlashCommandBuilder()
//         .setName('driver_laps')
//         .setDescription('Get all laps, lap times, and validity for a specific driver')
//         .addStringOption(option =>
//             option.setName('driver_name')
//                 .setDescription('Name of the driver')
//                 .setRequired(true)),

//     async execute(interaction) {
//         const driverName = interaction.options.getString('driver_name');
//         console.log('Received driver_name:', driverName); // Debug log

//         const filePath = path.join(__dirname, '../data/241216_224343_R(1).json');
//         let raceData;

//         // Read the race data file
//         try {
//             console.log('Reading results file...');
//             const data = fs.readFileSync(filePath, 'utf-8');
//             raceData = JSON.parse(data);
//             console.log('Race data loaded successfully');
//         } catch (error) {
//             console.error('❌ Error reading results file:', error);
//             return interaction.reply({
//                 content: '❌ Could not load race results data.',
//                 ephemeral: true,
//             });
//         }

//         // Find the driver in the leaderboard
//         const leaderboard = raceData?.sessionResult?.leaderBoardLines || [];
//         const driverEntry = leaderboard.find(entry => {
//             const driver = entry.car?.drivers?.[0];
//             const fullName = `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim();
//             return fullName.toLowerCase() === driverName.toLowerCase();
//         });

//         if (!driverEntry) {
//             console.log(`Driver ${driverName} not found`);
//             return interaction.reply({
//                 content: `❌ Driver **${driverName}** not found in the race results.`,
//                 ephemeral: true,
//             });
//         }

//         // Get the driver's carId
//         const carId = driverEntry.car.carId;
//         console.log(`Driver ${driverName} carId: ${carId}`);

//         // Extract all laps and filter them by carId
//         const laps = raceData?.laps || [];
//         const driverLaps = laps.filter(lap => lap.carId === carId);

//         if (driverLaps.length === 0) {
//             return interaction.reply({
//                 content: `❌ No laps found for driver **${driverName}**.`,
//                 ephemeral: true,
//             });
//         }

//         // Prepare lap details
//         const lapDetails = driverLaps.map((lap, index) => ({
//             lap_number: index + 1,
//             lap_time: formatLapTime(lap.laptime),
//             validity: lap.isValidForBest ? '✅ Valid' : '❌ Invalid'
//         }));

//         // Split lap details into chunks of 25
//         const chunkSize = 25;
//         const lapChunks = [];
//         for (let i = 0; i < lapDetails.length; i += chunkSize) {
//             lapChunks.push(lapDetails.slice(i, i + chunkSize));
//         }

//         // Send each chunk as an embed
//         try {
//             for (const [index, chunk] of lapChunks.entries()) {
//                 const embed = new EmbedBuilder()
//                     .setColor('#0099ff')
//                     .setTitle(`🏎️ Laps for ${driverName} (Page ${index + 1}/${lapChunks.length})`)
//                     .setDescription('List of all laps with lap times and validity:')
//                     .setFooter({ text: 'ACC Race Stats', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

//                 chunk.forEach(lap => {
//                     embed.addFields({
//                         name: `Lap ${lap.lap_number}`,
//                         value: `⏱️ **Time:** ${lap.lap_time}\n📝 **Validity:** ${lap.validity}`,
//                         inline: true
//                     });
//                 });

//                 if (index === 0) {
//                     await interaction.reply({ embeds: [embed] });
//                 } else {
//                     await interaction.followUp({ embeds: [embed] });
//                 }
//             }
//             console.log('Laps response sent successfully');
//         } catch (error) {
//             console.error('❌ Error sending response:', error);
//             return interaction.reply({
//                 content: '❌ There was an error processing the request.',
//                 ephemeral: true,
//             });
//         }
//     },
// };
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper function to format lap times (from ms to MM:SS:MS)
function formatLapTime(ms) {
    if (ms === 'N/A' || ms == null) return 'N/A';

    const minutes = Math.floor(ms / 60000); // 1 minute = 60000 ms
    const seconds = Math.floor((ms % 60000) / 1000); // Remaining seconds
    const milliseconds = ms % 1000; // Remaining milliseconds

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
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
        console.log('Received driver_name:', driverName); // Debug log

        const filePath = path.join(__dirname, '../data/241216_224343_R(1).json');
        let raceData;

        // Read the race data file
        try {
            console.log('Reading results file...');
            const data = fs.readFileSync(filePath, 'utf-8');
            raceData = JSON.parse(data);
            console.log('Race data loaded successfully');
        } catch (error) {
            console.error('❌ Error reading results file:', error);
            return interaction.reply({
                content: '❌ Could not load race results data.',
                ephemeral: true,
            });
        }

        // Find the driver in the leaderboard
        const leaderboard = raceData?.sessionResult?.leaderBoardLines || [];
        const driverEntry = leaderboard.find(entry => {
            const driver = entry.car?.drivers?.[0];
            const fullName = `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim();
            return fullName.toLowerCase() === driverName.toLowerCase();
        });

        if (!driverEntry) {
            console.log(`Driver ${driverName} not found`);
            return interaction.reply({
                content: `❌ Driver **${driverName}** not found in the race results.`,
                ephemeral: true,
            });
        }

        // Get the driver's carId
        const carId = driverEntry.car.carId;
        console.log(`Driver ${driverName} carId: ${carId}`);

        // Extract all laps and filter them by carId
        const laps = raceData?.laps || [];
        const driverLaps = laps.filter(lap => lap.carId === carId);

        if (driverLaps.length === 0) {
            return interaction.reply({
                content: `❌ No laps found for driver **${driverName}**.`,
                ephemeral: true,
            });
        }

        // Filter valid laps and calculate average valid lap time
        const validLaps = driverLaps
            .filter(lap => lap.isValidForBest)
            .map(lap => lap.laptime);

        const averageValidLapTimeInMs = validLaps.length > 0 
            ? validLaps.reduce((sum, time) => sum + time, 0) / validLaps.length 
            : null;

        // Prepare driver stats
        const driverStats = {
            driver_name: `${driverEntry.car.drivers[0]?.firstName} ${driverEntry.car.drivers[0]?.lastName}`,
            car: driverEntry.car?.carModel || 'N/A',
            fastest_lap: formatLapTime(driverEntry.timing?.bestLap),
            lap_count: driverEntry.timing?.lapCount || 'N/A',
            average_valid_lap_time: averageValidLapTimeInMs 
                ? formatLapTime(Math.round(averageValidLapTimeInMs)) 
                : 'N/A',
        };

        // Build the embed response
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🏎️ Driver Stats: ${driverStats.driver_name}`)
            .addFields(
                { name: '⚡ Fastest Lap', value: driverStats.fastest_lap?.toString(), inline: true },
                { name: '⏱️ Average Valid Lap Time', value: driverStats.average_valid_lap_time?.toString(), inline: true },
                { name: '🏁 Total Laps', value: driverStats.lap_count?.toString(), inline: true },
                { name: '🏎️ Car', value: driverStats.car?.toString(), inline: false }
            )
            .setFooter({ text: 'ACC Race Stats', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

        // Reply to Discord with the embed
        try {
            await interaction.reply({ embeds: [embed] });
            console.log('Driver stats response sent successfully');
        } catch (error) {
            console.error('❌ Error sending response:', error);
            return interaction.reply({
                content: '❌ There was an error processing the request.',
                ephemeral: true,
            });
        }
    },
};
