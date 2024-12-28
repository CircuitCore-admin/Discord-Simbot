const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver_car_track')
        .setDescription('Get driver-specific stats for a track and car model')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('Specify the track ID (e.g., spa)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('car_model')
                .setDescription('Specify the car model (e.g., GT3)')
                .setRequired(true)
                .setAutocomplete(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Mention another Discord user (optional)')
                .setRequired(false)),

    async execute(interaction) {
        let trackId = interaction.options.getString('track');
        let carModel = interaction.options.getString('car_model');
        const user = interaction.options.getUser('user') || interaction.user;

        console.log(`🛠️ Executing /driver_car_track for user: ${user.username}`);

        try {
            const discordId = user.id;

            // Fetch steam_id from driver_info
            const driverQuery = `SELECT steam_id FROM driver_info WHERE discord_id = $1`;
            const driverResult = await db.query(driverQuery, [discordId]);

            if (driverResult.rows.length === 0) {
                return interaction.reply({
                    content: `No Steam ID found for the selected user. Please ensure they're registered.`,
                    ephemeral: true,
                });
            }

            const steamId = driverResult.rows[0].steam_id;

            // Normalize inputs
            trackId = trackId.toLowerCase().replace(/\s+/g, '_');
            carModel = carModel.trim();

            // Fetch car & track-specific data
            const carTrackDataQuery = `
                            SELECT 
                                distance_covered, total_sessions, best_q_position, best_r_position, 
                                total_laps
                            FROM driver_car_track_info 
                            WHERE steam_id = $1 AND track_id = $2 AND car_model = $3`;
            const carTrackDataResult = await db.query(carTrackDataQuery, [steamId, trackId, carModel]);

            if (carTrackDataResult.rows.length === 0) {
                console.warn(`⚠️ No data found for ${user.username} on ${trackId} with ${carModel}`);
                return interaction.reply({
                    content: `No data found for **${user.username}** on track **${trackId}** with car **${carModel}**.`,
                    ephemeral: true,
                });
            }

            const carTrackData = carTrackDataResult.rows[0];

            console.log(`✅ Data found for ${user.username} on ${trackId} with ${carModel}`);

            const embed = new EmbedBuilder()
                .setTitle(`Driver Car Track Info: ${user.username} at ${trackId} with ${carModel}`)
                .addFields(
                    { name: 'Distance Covered', value: carTrackData.distance_covered?.toString() || 'N/A', inline: true },
                    { name: 'Total Sessions', value: carTrackData.total_sessions?.toString() || '0', inline: true },
                    { name: 'Best Qualifying Position', value: carTrackData.best_q_position?.toString() || 'N/A', inline: true },
                    { name: 'Best Race Position', value: carTrackData.best_r_position?.toString() || 'N/A', inline: true },
                    { name: 'Total Laps', value: carTrackData.total_laps?.toString() || '0', inline: true }
                )
                .setColor('#0099ff');

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error retrieving driver car track info:', error);
            return interaction.reply({
                content: 'An error occurred while retrieving driver car track info.',
                ephemeral: true,
            });
        }
    },

    // Autocomplete handler
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        try {
            if (focusedOption.name === 'track') {
                console.log(`🔄 Autocomplete triggered for track: ${focusedOption.value}`);

                const trackQuery = `
                    SELECT track_id, track_name 
                    FROM track_info 
                    WHERE track_name ILIKE $1 OR track_id ILIKE $1
                    LIMIT 25`;
                const trackResults = await db.query(trackQuery, [`%${focusedOption.value}%`]);

                // console.log(`🔄 Track Query Results:`, trackResults.rows);

                if (trackResults.rows.length === 0) {
                    return interaction.respond([{ name: 'No tracks found', value: 'No tracks found' }]);
                }

                await interaction.respond(
                    trackResults.rows.map(row => ({
                        name: row.track_name,
                        value: String(row.track_id) // Ensure value is always a string
                    }))
                );
            } else if (focusedOption.name === 'car_model') {
                console.log(`🔄 Autocomplete triggered for car_model: ${focusedOption.value}`);

                const carQuery = `
                    SELECT DISTINCT car_model 
                    FROM car_info 
                    WHERE car_model ILIKE $1 
                    LIMIT 25`;
                const carResults = await db.query(carQuery, [`%${focusedOption.value}%`]);

                // console.log(`🔄 Car Query Results:`, carResults.rows);

                if (carResults.rows.length === 0) {
                    return interaction.respond([{ name: 'No car models found', value: 'No car models found' }]);
                }

                await interaction.respond(
                    carResults.rows.map(row => ({
                        name: row.car_model,
                        value: String(row.car_model) // Ensure value is always a string
                    }))
                );
            }
        } catch (error) {
            console.error('❌ Error handling autocomplete:', error);
            await interaction.respond([{ name: 'Error retrieving options', value: 'error' }]);
        }
    }
};