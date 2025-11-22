// commands/delete_hotlap.js
const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_hotlap')
        .setDescription('Delete a hotlap record (Admin only)')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('The name of the track location')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The Discord tag of the user')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The exact lap time string (e.g., "1:27.705")')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false), // Command cannot be used in DMs

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const guildId = interaction.guildId;

        try {
            if (focusedOption.name === 'track') {
                // Get distinct track locations for this guild
                const result = await db.query(
                    'SELECT DISTINCT track_location_name FROM hotlaps WHERE guild_id = $1 AND track_location_name ILIKE $2 ORDER BY track_location_name LIMIT 25',
                    [guildId, `%${focusedOption.value}%`]
                );
                
                const choices = result.rows
                    .map(row => row.track_location_name)
                    .filter(track => track) // Null safety check
                    .map(track => ({ name: track, value: track }));
                
                await interaction.respond(choices);
            } else if (focusedOption.name === 'name') {
                // Get distinct discord tags, optionally filtered by track if one is selected
                const trackLocation = interaction.options.getString('track');
                
                let query, params;
                if (trackLocation) {
                    // Filter by track if one is selected
                    query = 'SELECT DISTINCT discord_tag FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 AND discord_tag ILIKE $3 ORDER BY discord_tag LIMIT 25';
                    params = [guildId, trackLocation, `%${focusedOption.value}%`];
                } else {
                    // Show all drivers from this guild if no track selected
                    query = 'SELECT DISTINCT discord_tag FROM hotlaps WHERE guild_id = $1 AND discord_tag ILIKE $2 ORDER BY discord_tag LIMIT 25';
                    params = [guildId, `%${focusedOption.value}%`];
                }

                const result = await db.query(query, params);
                
                const choices = result.rows
                    .map(row => row.discord_tag)
                    .filter(tag => tag) // Null safety check
                    .map(tag => ({ name: tag, value: tag }));
                
                await interaction.respond(choices);
            } else if (focusedOption.name === 'time') {
                // Get lap times, optionally filtered by track and/or driver
                const trackLocation = interaction.options.getString('track');
                const discordTag = interaction.options.getString('name');
                
                let query, params;
                if (trackLocation && discordTag) {
                    // Filter by both track and driver if both are selected
                    query = 'SELECT DISTINCT lap_time FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 AND discord_tag = $3 AND lap_time ILIKE $4 ORDER BY lap_time LIMIT 25';
                    params = [guildId, trackLocation, discordTag, `%${focusedOption.value}%`];
                } else if (trackLocation) {
                    // Filter by track only if track is selected
                    query = 'SELECT DISTINCT lap_time FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 AND lap_time ILIKE $3 ORDER BY lap_time LIMIT 25';
                    params = [guildId, trackLocation, `%${focusedOption.value}%`];
                } else if (discordTag) {
                    // Filter by driver only if driver is selected
                    query = 'SELECT DISTINCT lap_time FROM hotlaps WHERE guild_id = $1 AND discord_tag = $2 AND lap_time ILIKE $3 ORDER BY lap_time LIMIT 25';
                    params = [guildId, discordTag, `%${focusedOption.value}%`];
                } else {
                    // Show all lap times from this guild if nothing is selected
                    query = 'SELECT DISTINCT lap_time FROM hotlaps WHERE guild_id = $1 AND lap_time ILIKE $2 ORDER BY lap_time LIMIT 25';
                    params = [guildId, `%${focusedOption.value}%`];
                }

                const result = await db.query(query, params);
                
                const choices = result.rows
                    .map(row => row.lap_time)
                    .filter(time => time) // Null safety check
                    .map(time => ({ name: time, value: time }));
                
                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('❌ Error in autocomplete:', error);
            // Always respond with empty array on error to prevent interaction failure
            try {
                await interaction.respond([]);
            } catch (respondError) {
                console.error('❌ Could not respond to autocomplete:', respondError);
            }
        }
    },

    async execute(interaction) {
        // Check if command is used in a guild
        if (!interaction.guildId) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const trackLocation = interaction.options.getString('track');
        const discordTag = interaction.options.getString('name');
        const lapTime = interaction.options.getString('time');
        const guildId = interaction.guildId;

        try {
            // Fetch the specific hotlap record(s)
            const result = await db.query(
                'SELECT * FROM hotlaps WHERE guild_id = $1 AND track_location_name = $2 AND discord_tag = $3 AND lap_time = $4',
                [guildId, trackLocation, discordTag, lapTime]
            );

            if (result.rows.length === 0) {
                return interaction.reply({
                    content: `❌ No hotlap record found for user "${discordTag}" with lap time "${lapTime}" on track "${trackLocation}" in this server.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (result.rows.length > 1) {
                // Multiple records found - let user choose by submission date
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`delete-hotlap-select-${guildId}`)
                    .setPlaceholder('Select which lap to delete')
                    .addOptions(
                        result.rows.map(row => ({
                            label: `Submitted: ${new Date(row.submission_date).toLocaleString()}`,
                            description: `ID: ${row.id} | ${row.driver_name} - ${row.lap_time}`,
                            value: row.id.toString()
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: `⚠️ Multiple records found for user "${discordTag}" with lap time "${lapTime}" on track "${trackLocation}".\nPlease select which one to delete based on submission date:`,
                    components: [row],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Single record found - delete it directly
            const record = result.rows[0];
            
            await db.query('DELETE FROM hotlaps WHERE id = $1', [record.id]);

            await interaction.reply({
                content: `✅ Successfully deleted hotlap record!\n\n**Details:**\n🏎️ Driver: ${record.discord_tag}\n🏁 Track: ${record.track_location_name}\n⏱️ Lap Time: ${record.lap_time}\n📅 Submitted: ${new Date(record.submission_date).toLocaleString()}`
            });

        } catch (error) {
            console.error('❌ Error in delete command:', error);
            // Check if we've already replied
            if (!interaction.replied && !interaction.deferred) {
                try {
                    return interaction.reply({
                        content: '⚠️ An error occurred while deleting the hotlap record. Please try again.',
                        flags: [MessageFlags.Ephemeral]
                    });
                } catch (replyError) {
                    console.error('❌ Could not send error message to user:', replyError);
                }
            }
        }
    }
};
