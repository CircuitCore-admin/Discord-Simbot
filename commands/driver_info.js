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
            option.setName('driver_name')
                .setDescription('Search by Driver Real Name')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const driverName = interaction.options.getString('driver_name');

        try {
            const discordId = user.id;

            // Query to check if the user exists in driver_info table
            const checkUserExistQuery = 'SELECT * FROM driver_info WHERE discord_id = $1';
            const checkUserExistResult = await db.query(checkUserExistQuery, [discordId]);

            if (checkUserExistResult.rows.length === 0) {
                return interaction.reply(`User not found in the driver database. Please use the /register command.`);
            }

            // User exists, retrieve driver data
            const driverDataQuery = `
                SELECT 
                    total_laps_driven, distance_covered, real_name, podiums, 
                    total_wins, best_position, best_qualifying_position, total_poles, 
                    average_finish_position, total_off_tracks, total_races, 
                    total_qualifying_sessions, total_practice_sessions
                FROM driver_info 
                WHERE discord_id = $1`;
            const driverDataResult = await db.query(driverDataQuery, [discordId]);

            if (driverDataResult.rows.length === 0) {
                return interaction.reply(`No detailed data found for the user.`);
            }

            const driver = driverDataResult.rows[0];

            // Create an embed message with driver data
            const embed = new EmbedBuilder()
                .setTitle(`Driver Info: ${driver.real_name}`)
                .addFields(
                    { name: 'Total Laps', value: driver.total_laps_driven.toString(), inline: true },
                    { name: 'Distance Covered', value: driver.distance_covered.toString(), inline: true },
                    { name: 'Total Podiums', value: driver.podiums.toString(), inline: true },
                    { name: 'Total Wins', value: driver.total_wins ? driver.total_wins.toString() : '0', inline: true },
                    { name: 'Best Position', value: driver.best_position ? driver.best_position.toString() : 'N/A', inline: true },
                    { name: 'Best Qualifying Position', value: driver.best_qualifying_position ? driver.best_qualifying_position.toString() : 'N/A', inline: true },
                    { name: 'Total Poles', value: driver.total_poles ? driver.total_poles.toString() : '0', inline: true },
                    { name: 'Average Finish Position', value: driver.average_finish_position ? driver.average_finish_position.toString() : 'N/A', inline: true },
                    { name: 'Total Off Tracks', value: driver.total_off_tracks.toString(), inline: true },
                    { name: 'Total Races', value: driver.total_races.toString(), inline: true },
                    { name: 'Total Qualifying Sessions', value: driver.total_qualifying_sessions.toString(), inline: true },
                    { name: 'Total Practice Sessions', value: driver.total_practice_sessions.toString(), inline: true }
                )
                .setColor('#0099ff');

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error retrieving driver info:', error);
            return interaction.reply('An error occurred while retrieving driver info.');
        }
    },
};