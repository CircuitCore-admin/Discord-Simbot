const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add_track')
        .setDescription('Add a new track to the database')
        .addStringOption(option =>
            option.setName('track_name')
                .setDescription('Name of the track')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Location of the track')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('layout')
                .setDescription('Layout of the track (optional)')
                .setRequired(false)) // Layout is now optional
        .addNumberOption(option =>
            option.setName('track_length')
                .setDescription('Length of the track in kilometers or meters')
                .setRequired(true)),

    async execute(interaction) {
        const trackName = interaction.options.getString('track_name').trim();
        const location = interaction.options.getString('location').trim();
        const layout = interaction.options.getString('layout')?.trim() || null; // Default to null if not provided
        const trackLength = interaction.options.getNumber('track_length');

        console.log(`🚀 Adding Track: ${trackName} | Location: ${location} | Layout: ${layout || 'N/A'} | Length: ${trackLength} km`);

        try {
            // Check if the track already exists
            const existingTrack = await db.query(
                `SELECT * FROM track_info WHERE track_name = $1 AND COALESCE(layout, '') = COALESCE($2, '')`,
                [trackName, layout]
            );

            if (existingTrack.rows.length > 0) {
                console.warn(`⚠️ Track already exists: ${trackName} (${layout || 'No Layout'})`);
                return interaction.reply(`⚠️ Track **${trackName} (${layout || 'No Layout'})** already exists in the database.`);
            }

            // Insert new track into the database
            await db.query(
                `INSERT INTO track_info (track_name, location, layout, track_length) 
                 VALUES ($1, $2, $3, $4)`,
                [trackName, location, layout, trackLength]
            );

            console.log(`✅ Track Added: ${trackName} (${layout || 'No Layout'})`);
            await interaction.reply(`✅ Track **${trackName}** added successfully! Layout: **${layout || 'N/A'}**`);
        } catch (error) {
            console.error('❌ Database Error:', error.message);
            await interaction.reply('❌ Failed to add track. Please try again later.');
        }
    },
};
