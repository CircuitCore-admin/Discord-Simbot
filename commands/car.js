const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('car')
        .setDescription('Get driver-specific stats for a selected car model')
        .addStringOption(option =>
            option.setName('car_model')
                .setDescription('Select a car model (e.g., Ferrari 296 GT3 2023)')
                .setRequired(true)
                .setAutocomplete(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Mention another user to view their car stats (optional)')
                .setRequired(false)),

    async execute(interaction) {
        const carModel = interaction.options.getString('car_model');
        const user = interaction.options.getUser('user') || interaction.user;

        console.log(`🛠️ Fetching car stats for: ${user.username}, Car Model: ${carModel}`);

        try {
            const discordId = user.id;

            // Fetch steam_id
            const driverQuery = `SELECT steam_id FROM driver_info WHERE discord_id = $1`;
            const driverResult = await db.query(driverQuery, [discordId]);

            if (driverResult.rows.length === 0) {
                return interaction.reply({
                    content: `No Steam ID found for **${user.username}**. Please ensure they're registered.`,
                    ephemeral: true,
                });
            }

            const steamId = driverResult.rows[0].steam_id;

            // Fetch car-specific data
            const carStatsQuery = `
                SELECT 
                    total_sessions, total_laps, distance_covered, total_off_tracks, 
                    best_r_position, best_q_position, fastest_r_lap, fastest_q_lap,
                    average_valid_r, average_valid_q
                FROM driver_car_stats 
                WHERE steam_id = $1 AND car_model_id = (
                    SELECT car_id FROM car_info WHERE car_model = $2
                )`;
            const carStatsResult = await db.query(carStatsQuery, [steamId, carModel]);

            if (carStatsResult.rows.length === 0) {
                return interaction.reply({
                    content: `No data found for **${user.username}** with car model **${carModel}**.`,
                    ephemeral: true,
                });
            }

            const carStats = carStatsResult.rows[0];

            const embed = new EmbedBuilder()
                .setTitle(`Car Stats: ${carModel} - ${user.username}`)
                .addFields(
                    { name: 'Total Sessions', value: carStats.total_sessions.toString(), inline: true },
                    { name: 'Total Laps', value: carStats.total_laps.toString(), inline: true },
                    { name: 'Distance Covered', value: carStats.distance_covered.toString(), inline: true },
                    { name: 'Best Race Position', value: carStats.best_r_position?.toString() || 'N/A', inline: true },
                    { name: 'Best Qualifying Position', value: carStats.best_q_position?.toString() || 'N/A', inline: true }
                )
                .setColor('#0099ff');

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error fetching car stats:', error);
            return interaction.reply({
                content: 'An error occurred while fetching car stats.',
                ephemeral: true,
            });
        }
    },

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'car_model') {
            try {
                const carQuery = `
                    SELECT car_model
                    FROM car_info 
                    WHERE car_model ILIKE $1 
                    LIMIT 25`;
                const carResults = await db.query(carQuery, [`%${focusedOption.value}%`]);

                await interaction.respond(
                    carResults.rows.map(row => ({
                        name: row.car_model,
                        value: row.car_model
                    }))
                );
            } catch (error) {
                console.error('❌ Autocomplete Error:', error);
                await interaction.respond([]);
            }
        }
    }
};
