const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver_info')
        .setDescription('Get details about a specific driver or auto-register if partially missing')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Mention the Discord user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('driver_name')
                .setDescription('Search by Driver Real Name')
                .setRequired(false)),

    async execute(interaction) {
        const user = interaction.options.getUser('user'); // Get the mentioned user
        const driverName = interaction.options.getString('driver_name'); // Get the driver name input

        console.log(`🚀 Searching for driver: User - ${user?.username || 'None'}, Driver Name - ${driverName || 'None'}`);

        try {
            let query = '';
            let params = [];

            if (user) {
                // Search by Discord ID or username if a user is mentioned
                query = `
                    SELECT discord_id, username, real_name, steam_id, total_laps, podiums, best_position 
                    FROM driver_info 
                    WHERE discord_id = $1 OR username = $2
                    LIMIT 1`;
                params = [user.id, user.username];
            } else if (driverName) {
                // Search by Driver Real Name
                query = `
                    SELECT discord_id, username, real_name, steam_id, total_laps, podiums, best_position 
                    FROM driver_info 
                    WHERE real_name ILIKE $1
                    LIMIT 1`;
                params = [`%${driverName}%`];
            } else {
                return await interaction.reply({
                    content: '❌ Please provide either a Discord user mention or a driver name.',
                    ephemeral: true
                });
            }

            const result = await db.query(query, params);
            let driver = result.rows[0];

            if (driver) {
                // Update if Discord ID or username is missing
                let updated = false;
                if (user && !driver.username && driver.discord_id === user.id) {
                    await db.query(
                        `UPDATE driver_info SET username = $1 WHERE discord_id = $2`,
                        [user.username, user.id]
                    );
                    driver.username = user.username;
                    updated = true;
                }

                if (user && !driver.discord_id && driver.username === user.username) {
                    await db.query(
                        `UPDATE driver_info SET discord_id = $1 WHERE username = $2`,
                        [user.id, user.username]
                    );
                    driver.discord_id = user.id;
                    updated = true;
                }

                if (updated) {
                    console.log('🔄 Driver entry updated with missing details.');
                }

                // Build the embed with driver info
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🏎️ Driver Information')
                    .addFields(
                        { name: '🆔 Discord ID', value: driver.discord_id || 'N/A', inline: true },
                        { name: '👤 Username', value: driver.username || 'N/A', inline: true },
                        { name: '📛 Real Name', value: driver.real_name || 'N/A', inline: true },
                        { name: '🎮 Steam ID', value: driver.steam_id || 'N/A', inline: true },
                        { name: '🏁 Total Laps', value: driver.total_laps?.toString() || '0', inline: true },
                        { name: '🏆 Podiums', value: driver.podiums?.toString() || '0', inline: true },
                        { name: '🥇 Best Position', value: driver.best_position?.toString() || 'N/A', inline: true }
                    )
                    .setFooter({
                        text: `Requested by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } else {
                // Auto-register if no entry exists
                if (user) {
                    await db.query(
                        `INSERT INTO driver_info (discord_id, username) 
                         VALUES ($1, $2) 
                         ON CONFLICT DO NOTHING`,
                        [user.id, user.username]
                    );

                    console.log('📝 New driver entry created via Discord mention.');
                    await interaction.reply({
                        content: `✅ **${user.username}** was not found in the database. A new entry has been created with their Discord ID and username.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `❌ No driver found with the given details.`,
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error fetching/updating driver info:', error.message);
            await interaction.reply('❌ Failed to fetch or update driver information. Please try again later.');
        }
    },
};
