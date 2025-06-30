// commands/set_hotlap_channel.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js'); // Import MessageFlags
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set_hotlap_channel')
        .setDescription('Sets the channel where hotlap screenshots will be automatically analyzed.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to designate for hotlap submissions.')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) // Only users with Manage Channels permission
        .setDMPermission(false), // Command cannot be used in DMs

    async execute(interaction) {
        // Define the allowed user ID
        const allowedUserId = '296221250785771520'; // Your Discord User ID

        // Check if the interaction user's ID matches the allowed user ID
        if (interaction.user.id !== allowedUserId) {
            return interaction.reply({
                content: '🚫 You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral // Changed from ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        if (!guildId) {
            return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral }); // Changed from ephemeral: true
        }

        try {
            await db.query(
                `INSERT INTO guild_settings (guild_id, hotlap_channel_id)
                 VALUES ($1, $2)
                 ON CONFLICT (guild_id) DO UPDATE SET hotlap_channel_id = EXCLUDED.hotlap_channel_id;`,
                [guildId, channel.id]
            );

            await interaction.reply({
                content: `✅ The hotlap submission channel for this server has been set to ${channel}!`,
                flags: MessageFlags.Ephemeral // Changed from ephemeral: true
            });
        } catch (error) {
            console.error('❌ Error setting hotlap channel:', error);
            await interaction.reply({
                content: 'There was an error trying to set the hotlap channel. Please try again.',
                flags: MessageFlags.Ephemeral // Changed from ephemeral: true
            });
        }
    },
};