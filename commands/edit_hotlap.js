// commands/edit_hotlap.js
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Edit an existing hotlap record')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The Discord tag of the user whose lap needs editing')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The exact lap time string (e.g., "1:27.705")')
                .setRequired(true)
        )
        .setDMPermission(false), // Command cannot be used in DMs

    async execute(interaction) {
        // Check if command is used in a guild
        if (!interaction.guildId) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                ephemeral: true
            });
        }

        const discordTag = interaction.options.getString('name');
        const lapTime = interaction.options.getString('time');
        const guildId = interaction.guildId;

        try {
            // Fetch the specific hotlap record
            const result = await db.query(
                'SELECT * FROM hotlaps WHERE guild_id = $1 AND discord_tag = $2 AND lap_time = $3',
                [guildId, discordTag, lapTime]
            );

            if (result.rows.length === 0) {
                return interaction.reply({
                    content: `❌ No hotlap record found for user "${discordTag}" with lap time "${lapTime}" in this server.`,
                    ephemeral: true
                });
            }

            if (result.rows.length > 1) {
                return interaction.reply({
                    content: `⚠️ Multiple records found for user "${discordTag}" with lap time "${lapTime}". Please contact an administrator for manual resolution.`,
                    ephemeral: true
                });
            }

            // Single record found - show modal
            const record = result.rows[0];
            
            // Create modal
            const modal = new ModalBuilder()
                .setCustomId(`edit-hotlap-${record.id}`)
                .setTitle(`Edit Lap: ${record.driver_name} - ${record.lap_time}`);

            // Create text input components
            const driverNameInput = new TextInputBuilder()
                .setCustomId('driver_name')
                .setLabel('Driver Name')
                .setStyle(TextInputStyle.Short)
                .setValue(record.driver_name || '')
                .setRequired(true);

            const teamNameInput = new TextInputBuilder()
                .setCustomId('team_name')
                .setLabel('Team Name')
                .setStyle(TextInputStyle.Short)
                .setValue(record.team_name || '')
                .setRequired(true);

            const lapTimeInput = new TextInputBuilder()
                .setCustomId('lap_time')
                .setLabel('Lap Time (e.g., 1:23.456)')
                .setStyle(TextInputStyle.Short)
                .setValue(record.lap_time || '')
                .setRequired(true);

            const s1TimeInput = new TextInputBuilder()
                .setCustomId('s1_time')
                .setLabel('Sector 1 Time')
                .setStyle(TextInputStyle.Short)
                .setValue(record.s1_time || '')
                .setRequired(true);

            const s2TimeInput = new TextInputBuilder()
                .setCustomId('s2_time')
                .setLabel('Sector 2 Time')
                .setStyle(TextInputStyle.Short)
                .setValue(record.s2_time || '')
                .setRequired(true);

            const s3TimeInput = new TextInputBuilder()
                .setCustomId('s3_time')
                .setLabel('Sector 3 Time')
                .setStyle(TextInputStyle.Short)
                .setValue(record.s3_time || '')
                .setRequired(true);

            // Create action rows (modals can have up to 5 action rows)
            const row1 = new ActionRowBuilder().addComponents(driverNameInput);
            const row2 = new ActionRowBuilder().addComponents(teamNameInput);
            const row3 = new ActionRowBuilder().addComponents(lapTimeInput);
            const row4 = new ActionRowBuilder().addComponents(s1TimeInput);
            const row5 = new ActionRowBuilder().addComponents(s2TimeInput);

            modal.addComponents(row1, row2, row3, row4, row5);

            // Store the record in memory for the second modal
            // We'll use the interaction to pass data through customId
            // Note: We'll handle s3_time, is_valid, custom_setup, and track_location_name
            // in the modal submission handler by showing a second modal

            // Show the modal
            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Error in edit command:', error);
            return interaction.reply({
                content: '⚠️ An error occurred while fetching the hotlap record. Please try again.',
                ephemeral: true
            });
        }
    }
};
