const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add_track')
        .setDescription('Add a new track to the database')
        .addStringOption(option =>
            option.setName('track_id')
                .setDescription('Unique track identifier (e.g., red_bull_ring)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('track_name')
                .setDescription('Name of the track')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Location of the track')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('track_length')
                .setDescription('Length of the track in kilometers or meters')
                .setRequired(true)),

    async execute(interaction) {
        const trackId = interaction.options.getString('track_id').trim();
        const trackName = interaction.options.getString('track_name').trim();
        const location = interaction.options.getString('location').trim();
        const trackLength = interaction.options.getNumber('track_length');

        console.log(`🚀 Adding Track: ID: ${trackId} | Name: ${trackName} | Location: ${location} | Length: ${trackLength} km`);

        try {
            // Validate inputs (optional but recommended)
            if (!/^[a-zA-Z0-9-_]+$/.test(trackId)) {
                throw new Error('Invalid track_id format. Only alphanumeric, dashes, and underscores are allowed.');
            }

            if (trackLength <= 0) {
                throw new Error('Track length must be a positive number.');
            }

            // Check if the track already exists by track_id
            const { rows: existingTrack } = await db.query(
                `SELECT * FROM track_info WHERE track_id = $1`,
                [trackId]
            );

            if (existingTrack.length > 0) {
                console.warn(`⚠️ Track already exists: ${trackId}`);
                return interaction.reply(`⚠️ Track with ID **${trackId}** already exists in the database.`);
            }

            // Insert new track into the database
            await db.query(
                `INSERT INTO track_info (track_id, track_name, location, track_length) 
                 VALUES ($1, $2, $3, $4)`,
                [trackId, trackName, location, trackLength]
            );

            console.log(`✅ Track Added: ${trackId}`);
            await interaction.reply(`✅ Track **${trackName}** added successfully!`);
        } catch (error) {
            console.error('❌ Database Error:', error.message);
            await interaction.reply(`❌ Failed to add track: ${error.message}`);
        }
    },
};
