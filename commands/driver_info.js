const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver_info')
        .setDescription('Get details about a specific driver or auto-register them if not fully registered')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Mention the Discord user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Search by Driver Real Name')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const driverName = interaction.options.getString('name');
        
        try {
            let driverDataResult;
            let foundByUsername = false;

            if (user) {
                const discordId = user.id;

                // Step 1: Lookup by Discord ID
                const driverDataByIdQuery = `
                    SELECT 
                        total_laps_driven, distance_covered, real_name, podiums, 
                        total_wins, best_position, best_qualifying_position, total_poles, 
                        average_finish_position, total_off_tracks, total_races, 
                        total_qualifying_sessions, total_practice_sessions
                    FROM driver_info 
                    WHERE discord_id = $1`;
                driverDataResult = await db.query(driverDataByIdQuery, [discordId]);

                // Step 2: Fallback to Discord Username
                if (driverDataResult.rows.length === 0) {
                    const driverDataByUsernameQuery = `
                        SELECT 
                            total_laps_driven, distance_covered, real_name, podiums, 
                            total_wins, best_position, best_qualifying_position, total_poles, 
                            average_finish_position, total_off_tracks, total_races, 
                            total_qualifying_sessions, total_practice_sessions, username
                        FROM driver_info 
                        WHERE username ILIKE $1`;
                    driverDataResult = await db.query(driverDataByUsernameQuery, [user.username]);
                    foundByUsername = driverDataResult.rows.length > 0;
                }

                // Step 3: Update discord_id if found by username
                if (foundByUsername) {
                    const updateDiscordIdQuery = `
                        UPDATE driver_info
                        SET discord_id = $1
                        WHERE username ILIKE $2`;
                    await db.query(updateDiscordIdQuery, [user.id, user.username]);
                    console.log(`Updated discord_id for user: ${user.username}`);
                }
            } 
            
            // Step 4: Lookup by Real Name if provided
            if (driverName && (!user || driverDataResult.rows.length === 0)) {
                // Exact Match First
                const driverDataByNameQuery = `
                    SELECT 
                        total_laps_driven, distance_covered, real_name, podiums, 
                        total_wins, best_position, best_qualifying_position, total_poles, 
                        average_finish_position, total_off_tracks, total_races, 
                        total_qualifying_sessions, total_practice_sessions
                    FROM driver_info 
                    WHERE real_name ILIKE $1`;
                driverDataResult = await db.query(driverDataByNameQuery, [driverName]);

                // Fuzzy Matching
                if (driverDataResult.rows.length === 0) {
                    const fuzzyMatchQuery = `
                        SELECT real_name
                        FROM driver_info
                        WHERE SIMILARITY(real_name, $1) > 0.3
                        ORDER BY SIMILARITY(real_name, $1) DESC
                        LIMIT 1`;
                    const fuzzyMatchResult = await db.query(fuzzyMatchQuery, [driverName]);

                    if (fuzzyMatchResult.rows.length > 0) {
                        const suggestedName = fuzzyMatchResult.rows[0].real_name;
                        return interaction.reply({
                            content: `No exact match found for **${driverName}**. Did you mean **${suggestedName}**? Try using: \`/driver_info driver_name:${suggestedName}\``,
                            ephemeral: true,
                        });
                    }
                }
            }

            // Step 5: Handle No Results
            if (!driverDataResult || driverDataResult.rows.length === 0) {
                return interaction.reply({
                    content: 'No driver data found with the provided information.',
                    ephemeral: true,
                });
            }

            const driver = driverDataResult.rows[0];

            // Create an embed message with driver data
            const embed = new EmbedBuilder()
                .setTitle(`Driver Info: ${driver.real_name}`)
                .addFields(
                    { name: 'Total Laps', value: driver.total_laps_driven?.toString() || 'N/A', inline: true },
                    { name: 'Distance Covered', value: driver.distance_covered?.toString() || 'N/A', inline: true },
                    { name: 'Total Podiums', value: driver.podiums?.toString() || '0', inline: true },
                    { name: 'Total Wins', value: driver.total_wins?.toString() || '0', inline: true },
                    { name: 'Best Position', value: driver.best_position?.toString() || 'N/A', inline: true },
                    { name: 'Best Qualifying Position', value: driver.best_qualifying_position?.toString() || 'N/A', inline: true },
                    { name: 'Total Poles', value: driver.total_poles?.toString() || '0', inline: true },
                    { name: 'Average Finish Position', value: driver.average_finish_position?.toString() || 'N/A', inline: true },
                    { name: 'Total Off Tracks', value: driver.total_off_tracks?.toString() || '0', inline: true },
                    { name: 'Total Races', value: driver.total_races?.toString() || '0', inline: true },
                    { name: 'Total Qualifying Sessions', value: driver.total_qualifying_sessions?.toString() || '0', inline: true },
                    { name: 'Total Practice Sessions', value: driver.total_practice_sessions?.toString() || '0', inline: true }
                )
                .setColor('#0099ff');

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error retrieving driver info:', error);
            return interaction.reply({
                content: 'An error occurred while retrieving driver info.',
                ephemeral: true,
            });
        }
    },
};
