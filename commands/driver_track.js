const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver_track')
        .setDescription('Get driver-specific stats for a specific track')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Mention the Discord user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('track')
                .setDescription('Specify the track ID (e.g., spa)')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const trackId = interaction.options.getString('track');

        try {
            let driverTrackDataResult;

            if (!user) {
                return interaction.reply({
                    content: 'You need to mention a user or provide their details.',
                    ephemeral: true,
                });
            }

            const discordId = user.id;

            // Fetch steam_id from driver_info
            const driverQuery = `SELECT steam_id FROM driver_info WHERE discord_id = $1`;
            const driverResult = await db.query(driverQuery, [discordId]);

            if (driverResult.rows.length === 0) {
                return interaction.reply({
                    content: `No Steam ID found for the mentioned user. Please ensure they're registered.`,
                    ephemeral: true,
                });
            }

            const steamId = driverResult.rows[0].steam_id;

            // Fetch track-specific data
            const trackDataQuery = `
                SELECT 
                    distance_covered, total_sessions, best_q_position, best_r_position, 
                    fastest_q_lap, fastest_r_lap, total_off_tracks, total_laps, 
                    average_valid_fp, average_valid_q, average_valid_r
                FROM driver_track_info 
                WHERE steam_id = $1 AND track_id = $2`;
            driverTrackDataResult = await db.query(trackDataQuery, [steamId, trackId]);

            if (driverTrackDataResult.rows.length === 0) {
                return interaction.reply({
                    content: `No track data found for **${user.username}** on track **${trackId}**.`,
                    ephemeral: true,
                });
            }

            const trackData = driverTrackDataResult.rows[0];

            // Create Embed
            const embed = new EmbedBuilder()
                .setTitle(`Driver Track Info: ${user.username} at ${trackId}`)
                .addFields(
                    { name: 'Distance Covered', value: trackData.distance_covered?.toString() || 'N/A', inline: true },
                    { name: 'Total Sessions', value: trackData.total_sessions?.toString() || '0', inline: true },
                    { name: 'Best Qualifying Position', value: trackData.best_q_position?.toString() || 'N/A', inline: true },
                    { name: 'Best Race Position', value: trackData.best_r_position?.toString() || 'N/A', inline: true },
                    { name: 'Fastest Qualifying Lap', value: trackData.fastest_q_lap?.toString() || 'N/A', inline: true },
                    { name: 'Fastest Race Lap', value: trackData.fastest_r_lap?.toString() || 'N/A', inline: true },
                    { name: 'Total Off Tracks', value: trackData.total_off_tracks?.toString() || '0', inline: true },
                    { name: 'Total Laps', value: trackData.total_laps?.toString() || '0', inline: true },
                    { name: 'Average Valid FP', value: trackData.average_valid_fp?.toString() || 'N/A', inline: true },
                    { name: 'Average Valid Q', value: trackData.average_valid_q?.toString() || 'N/A', inline: true },
                    { name: 'Average Valid R', value: trackData.average_valid_r?.toString() || 'N/A', inline: true }
                )
                .setColor('#0099ff');

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error retrieving driver track info:', error);
            return interaction.reply({
                content: 'An error occurred while retrieving driver track info.',
                ephemeral: true,
            });
        }
    },
};
