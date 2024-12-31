const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const db = require('../services/database');

// Decode special characters properly
function normalizeText(text) {
    return text ? text.normalize('NFC') : text;
}
module.exports = {

    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Get the fastest lap times for a specific track')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('Select a track to view the leaderboard')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const result = await db.query(
                'SELECT track_name FROM track_info WHERE track_name ILIKE $1 LIMIT 25',
                [`%${focusedValue}%`]
            );

            const choices = result.rows.map(row => ({ name: row.track_name, value: row.track_name }));
            await interaction.respond(choices);
        } catch (error) {
            console.error('❌ Autocomplete Error:', error);
            await interaction.respond([]);
        }
    },

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(3);
        return `${minutes}:${seconds.padStart(6, '0')}`;
    },

    async fetchUserLapTime(track, userId) {
        const userResult = await db.query(`
            WITH unique_lap_times AS (
                SELECT 
                    d.steam_id,
                    d.real_name,
                    MIN(LEAST(dt.fastest_q_lap, dt.fastest_r_lap)) AS best_lap
                FROM driver_track_info dt
                JOIN driver_info d ON dt.steam_id = d.steam_id
                JOIN track_info t ON dt.track_id = t.track_id
                WHERE t.track_name = $1
                  AND LEAST(dt.fastest_q_lap, dt.fastest_r_lap) > 0
                GROUP BY d.steam_id, d.real_name
            ),
            user_lap AS (
                SELECT 
                    ul.real_name,
                    ul.best_lap
                FROM unique_lap_times ul
                JOIN driver_info d ON ul.steam_id = d.steam_id
                WHERE d.discord_id = $2
            )
            SELECT 
                u.real_name, 
                u.best_lap,
                (SELECT COUNT(*) + 1
                 FROM unique_lap_times ul2
                 WHERE ul2.best_lap < u.best_lap
                ) AS position
            FROM user_lap u;
        `, [track, userId]);

        return userResult.rows[0];
    },

    async fetchLeaderboard(track, page, pageSize) {
        const offset = (page - 1) * pageSize;

        // Fetch leaderboard entries for the current page
        const leaderboardResult = await db.query(`
            SELECT 
                d.real_name,
                MIN(LEAST(dt.fastest_q_lap, dt.fastest_r_lap)) AS best_lap
            FROM driver_track_info dt
            JOIN driver_info d ON dt.steam_id = d.steam_id
            JOIN track_info t ON dt.track_id = t.track_id
            WHERE t.track_name = $1
              AND LEAST(dt.fastest_q_lap, dt.fastest_r_lap) > 0
            GROUP BY d.real_name
            ORDER BY best_lap ASC
            LIMIT $2 OFFSET $3
        `, [track, pageSize, offset]);

        // Fetch the total number of unique lap entries
        const totalResult = await db.query(`
            SELECT COUNT(*) AS total
            FROM (
                SELECT DISTINCT d.steam_id
                FROM driver_track_info dt
                JOIN driver_info d ON dt.steam_id = d.steam_id
                JOIN track_info t ON dt.track_id = t.track_id
                WHERE t.track_name = $1
                  AND LEAST(dt.fastest_q_lap, dt.fastest_r_lap) > 0
            ) AS unique_drivers
        `, [track]);

        return {
            leaderboard: leaderboardResult.rows.map(row => ({
                real_name: normalizeText(row.real_name),
                best_lap: row.best_lap
            })),
            total: parseInt(totalResult.rows[0].total, 10) // Ensure total is correctly parsed
        };
    },

    async fetchUserLapTime(track, userId) {
        const userResult = await db.query(`
            WITH unique_lap_times AS (
                SELECT 
                    d.steam_id,
                    d.real_name,
                    MIN(LEAST(dt.fastest_q_lap, dt.fastest_r_lap)) AS best_lap
                FROM driver_track_info dt
                JOIN driver_info d ON dt.steam_id = d.steam_id
                JOIN track_info t ON dt.track_id = t.track_id
                WHERE t.track_name = $1
                  AND LEAST(dt.fastest_q_lap, dt.fastest_r_lap) > 0
                GROUP BY d.steam_id, d.real_name
            )
            SELECT 
                u.real_name, 
                u.best_lap,
                (SELECT COUNT(*) + 1
                 FROM unique_lap_times ul2
                 WHERE ul2.best_lap < u.best_lap
                ) AS position
            FROM unique_lap_times u
            JOIN driver_info d ON u.steam_id = d.steam_id
            WHERE d.discord_id = $2;
        `, [track, userId]);

        return userResult.rows[0] ? {
            real_name: normalizeText(userResult.rows[0].real_name),
            best_lap: userResult.rows[0].best_lap,
            position: userResult.rows[0].position
        } : null;
    },

    async execute(interaction) {
        const track = interaction.options.getString('track');
        const userId = interaction.user.id;
        let currentPage = 1;
        const pageSize = 10;

        try {
            let leaderboardData = await this.fetchLeaderboard(track, currentPage, pageSize);
            let userData = await this.fetchUserLapTime(track, userId);
            const totalPages = Math.ceil(leaderboardData.total / pageSize);
            const updateEmbed = (leaderboardData, userData, page) => {
                const { leaderboard, total } = leaderboardData;
                const totalPages = Math.ceil(total / pageSize);

                let leaderboardText = leaderboard.map((entry, index) =>
                    `**#${(page - 1) * pageSize + index + 1}** - **${normalizeText(entry.real_name)}**: ${this.formatTime(entry.best_lap)}s`
                ).join('\n');

                if (userData) {
                    leaderboardText += `\n\n**#${userData.position || '??'}** - **${normalizeText(userData.real_name)}**: ${this.formatTime(userData.best_lap)}s *(Your Time)*`;
                }

                return new EmbedBuilder()
                    .setTitle(`${track} - Leaderboard (Page ${page}/${totalPages})`)
                    .setColor(0x00FF00)
                    .setDescription(leaderboardText || 'No valid entries found.')
                    .setFooter({ text: 'Powered by CircuitCore' })
                    .setTimestamp();
            };

            const createPageSelector = (totalPages) => {
                return new StringSelectMenuBuilder()
                    .setCustomId('page_select')
                    .setPlaceholder('Select a page')
                    .addOptions(
                        [...Array(totalPages)].map((_, i) => ({
                            label: `Page ${i + 1}`,
                            value: `${i + 1}`
                        }))
                    );
            };
            let embed = updateEmbed(leaderboardData, userData, currentPage);

            // First row: Page Selector
            const selectRow = new ActionRowBuilder().addComponents(
                createPageSelector(totalPages)
            );

            // Second Row: Pagination Buttons
            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage >= totalPages)
            );

            const message = await interaction.reply({ embeds: [embed], components: [selectRow, buttonRow], fetchReply: true });

            // Collector for buttons
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            // Collector for dropdown
            const selectCollector = message.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000
            });

            // Handle Button Interactions
            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    return buttonInteraction.reply({
                        content: 'Only the original command user can interact with these buttons!',
                        ephemeral: true
                    });
                }

                if (buttonInteraction.customId === 'previous' && currentPage > 1) {
                    currentPage--;
                } else if (buttonInteraction.customId === 'next' && currentPage * pageSize < leaderboardData.total) {
                    currentPage++;
                }

                leaderboardData = await this.fetchLeaderboard(track, currentPage, pageSize);
                userData = await this.fetchUserLapTime(track, userId);
                embed = updateEmbed(leaderboardData, userData, currentPage);

                buttonRow.components[0].setDisabled(currentPage === 1);
                buttonRow.components[1].setDisabled(currentPage * pageSize >= leaderboardData.total);

                await buttonInteraction.update({
                    embeds: [embed],
                    components: [selectRow, buttonRow]
                });
            });

            // Handle Page Selection
            selectCollector.on('collect', async (selectInteraction) => {
                if (selectInteraction.user.id !== interaction.user.id) {
                    return selectInteraction.reply({
                        content: 'Only the original command user can interact with this!',
                        ephemeral: true
                    });
                }

                currentPage = parseInt(selectInteraction.values[0], 10);

                leaderboardData = await this.fetchLeaderboard(track, currentPage, pageSize);
                userData = await this.fetchUserLapTime(track, userId);
                embed = updateEmbed(leaderboardData, userData, currentPage);

                buttonRow.components[0].setDisabled(currentPage === 1);
                buttonRow.components[1].setDisabled(currentPage * pageSize >= leaderboardData.total);

                await selectInteraction.update({
                    embeds: [embed],
                    components: [selectRow, buttonRow]
                });
            });

            // Disable buttons and dropdown after timeout
            collector.on('end', async () => {
                buttonRow.components.forEach(button => button.setDisabled(true));
                selectRow.components.forEach(select => select.setDisabled(true));

                await interaction.editReply({
                    components: [selectRow, buttonRow]
                });
            });
        } catch (error) {
            console.error('❌ Error:', error);
            await interaction.reply({ content: 'Error occurred. Try again!', ephemeral: true });
        }
    }
};
