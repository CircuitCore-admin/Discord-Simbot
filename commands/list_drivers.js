const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list_drivers')
        .setDescription('List all registered drivers in the database'),

    async execute(interaction) {
        try {
            // Fetch all drivers from the database
            const result = await db.query('SELECT discord_id, username, real_name, steam_id FROM driver_info ORDER BY real_name ASC');

            if (result.rows.length === 0) {
                await interaction.reply('🚫 No drivers found in the database.');
                return;
            }

            // Create a formatted list
            const driverList = result.rows.map((row, index) => 
                `**${index + 1}.** **Name:** ${row.real_name || 'N/A'} | **Username:** ${row.username || 'N/A'} | **SteamID:** ${row.steam_id || 'N/A'} | **Discord ID:** ${row.discord_id || 'N/A'}`
            ).join('\n');

            // Send the driver list as an embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🏎️ Registered Drivers')
                .setDescription(driverList.length > 4000 ? 'The driver list is too long to display here.' : driverList)
                .setFooter({ text: `Total Drivers: ${result.rows.length}` })
                .setTimestamp();

            if (driverList.length > 4000) {
                await interaction.reply({
                    content: '🚫 The driver list is too long to display. Please refine your query.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('❌ Error fetching drivers from the database:', error.message);
            await interaction.reply('❌ Failed to fetch drivers. Please try again later.');
        }
    },
};
