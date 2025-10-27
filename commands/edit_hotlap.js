// commands/edit_hotlap.js
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Edit an existing hotlap record')
        .addStringOption(option =>
            option.setName('track_location')
                .setDescription('The name of the track location')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The Discord tag of the user whose lap needs editing')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The exact lap time string (e.g., "1:27.705")')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false), // Command cannot be used in DMs

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const guildId = interaction.guildId;

        try {
            if (focusedOption.name === 'track_location') {
                // Get distinct track locations for this guild
                const result = await db.query(
                    'SELECT DISTINCT track_location_name FROM hotlaps WHERE guild_id = $1 ORDER BY track_location_name',
                    [guildId]
                );
                
                const choices = result.rows
                    .map(row => row.track_location_name)
                    .filter(track => track.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25)
                    .map(track => ({ name: track, value: track }));
                
                await interaction.respond(choices);
            } else if (focusedOption.name === 'name') {
                // Get distinct discord tags for the selected track
                const trackLocation = interaction.options.getString('track_location');
                if (!trackLocation) {
                    return await interaction.respond([]);
                }

                const result = await db.query(
                    'SELECT DISTINCT discord_tag FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 ORDER BY discord_tag',
                    [guildId, trackLocation]
                );
                
                const choices = result.rows
                    .map(row => row.discord_tag)
                    .filter(tag => tag.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25)
                    .map(tag => ({ name: tag, value: tag }));
                
                await interaction.respond(choices);
            } else if (focusedOption.name === 'time') {
                // Get lap times for the selected track and user
                const trackLocation = interaction.options.getString('track_location');
                const discordTag = interaction.options.getString('name');
                
                if (!trackLocation || !discordTag) {
                    return await interaction.respond([]);
                }

                const result = await db.query(
                    'SELECT lap_time FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 AND discord_tag = $3 ORDER BY submission_date DESC',
                    [guildId, trackLocation, discordTag]
                );
                
                const choices = result.rows
                    .map(row => row.lap_time)
                    .filter(time => time.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25)
                    .map(time => ({ name: time, value: time }));
                
                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('❌ Error in autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        // Check if command is used in a guild
        if (!interaction.guildId) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                ephemeral: true
            });
        }

        const trackLocation = interaction.options.getString('track_location');
        const discordTag = interaction.options.getString('name');
        const lapTime = interaction.options.getString('time');
        const guildId = interaction.guildId;

        try {
            // Fetch the specific hotlap record
            const result = await db.query(
                'SELECT * FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 AND discord_tag = $3 AND lap_time = $4',
                [guildId, trackLocation, discordTag, lapTime]
            );

            if (result.rows.length === 0) {
                return interaction.reply({
                    content: `❌ No hotlap record found for user "${discordTag}" with lap time "${lapTime}" on track "${trackLocation}" in this server.`,
                    ephemeral: true
                });
            }

            if (result.rows.length > 1) {
                return interaction.reply({
                    content: `⚠️ Multiple records found for user "${discordTag}" with lap time "${lapTime}" on track "${trackLocation}". Please contact an administrator for manual resolution.`,
                    ephemeral: true
                });
            }

            // Single record found - show first modal with 5 fields
            const record = result.rows[0];
            
            // Create modal
            const modal = new ModalBuilder()
                .setCustomId(`edit-hotlap-${record.id}`)
                .setTitle(`Edit Lap: ${record.driver_name} - ${record.track_location_name} - ${record.lap_time}`);

            // Create text input components for first 5 editable fields
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

            // Create action rows (modals can have up to 5 action rows)
            const row1 = new ActionRowBuilder().addComponents(driverNameInput);
            const row2 = new ActionRowBuilder().addComponents(teamNameInput);
            const row3 = new ActionRowBuilder().addComponents(lapTimeInput);
            const row4 = new ActionRowBuilder().addComponents(s1TimeInput);
            const row5 = new ActionRowBuilder().addComponents(s2TimeInput);

            modal.addComponents(row1, row2, row3, row4, row5);

            // Show the modal - we'll handle s3_time, is_valid, and custom_setup in a second modal
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
