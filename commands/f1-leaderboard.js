// commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../services/database'); // Your database connection

// Helper function to fetch and construct the leaderboard embed
async function getLeaderboardEmbed(guildId, trackName, customSetupOnly, page, requestingUserId) {
    const lapsPerPage = 10; // Number of laps to display per page
    const offset = (page - 1) * lapsPerPage;

    // Step 1: Get the total count of valid laps for pagination
    let countQuery = `
        SELECT COUNT(*) FROM (
            SELECT 1
            FROM hotlaps
            WHERE guild_id = $1 AND track_location_name ILIKE $2 AND is_valid = TRUE
            GROUP BY user_id, track_location_name
        ) AS unique_laps;
    `;
    const countParams = [guildId, trackName];
    if (customSetupOnly) {
        countQuery = `
            SELECT COUNT(*) FROM (
                SELECT 1
                FROM hotlaps
                WHERE guild_id = $1 AND track_location_name ILIKE $2 AND is_valid = TRUE AND custom_setup = TRUE
                GROUP BY user_id, track_location_name
            ) AS unique_laps;
        `;
    }
    const totalLapsResult = await db.query(countQuery, countParams);
    const totalLaps = parseInt(totalLapsResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalLaps / lapsPerPage);

    // Ensure page is within valid bounds
    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    if (totalPages === 0) page = 1; // If no laps, default to page 1 to show the 'no laps' message

    // Step 2: Fetch the paginated leaderboard data
    let leaderboardQuery = `
        WITH RankedLaps AS (
            SELECT
                discord_tag,
                lap_time,
                user_id, -- Include user_id for highlighting
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, track_location_name
                    ORDER BY
                        CASE
                            WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                            WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                SPLIT_PART(lap_time, '.', 2)::INT
                            ELSE 999999999
                        END ASC,
                        submission_date ASC
                ) as rn
            FROM hotlaps
            WHERE guild_id = $1 AND track_location_name ILIKE $2 AND is_valid = TRUE
        ),
        GlobalRankedLaps AS (
            SELECT
                discord_tag,
                lap_time,
                user_id,
                ROW_NUMBER() OVER (
                    ORDER BY
                        CASE
                            WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                            WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                SPLIT_PART(lap_time, '.', 2)::INT
                            ELSE 999999999
                        END ASC
                ) as global_rank
            FROM RankedLaps
            WHERE rn = 1
    `;

    const leaderboardParams = [guildId, trackName];

    if (customSetupOnly) {
        leaderboardQuery += ` AND custom_setup = TRUE`;
    }

    leaderboardQuery += `
        )
        SELECT
            discord_tag,
            lap_time,
            user_id,
            global_rank
        FROM GlobalRankedLaps
        ORDER BY global_rank ASC
        LIMIT $3 OFFSET $4;
    `;
    leaderboardParams.push(lapsPerPage, offset);

    const result = await db.query(leaderboardQuery, leaderboardParams);
    const hotlaps = result.rows;

    const embed = new EmbedBuilder()
        .setTitle(`🏁 F1 Hotlap Leaderboard: ${trackName}`)
        .setColor(0xF10000)
        .setTimestamp()
        .setFooter({ text: `Page ${page}/${totalPages} | Data from recorded hotlaps` });

    let description = '';
    let userLapFoundOnPage = false;

    if (hotlaps.length === 0) {
        description = `No hotlaps found on page ${page} for "${trackName}"${customSetupOnly ? " with custom setup" : ""} in this server.`;
    } else {
        for (const lap of hotlaps) {
            const rank = lap.global_rank;
            const driverTag = lap.discord_tag;
            const lapTime = lap.lap_time;

            let line = `**${rank}. ${driverTag}** - \`${lapTime}\``;

            if (lap.user_id === requestingUserId) {
                line = `✨ ${line} (Your Best Lap)`; // Highlight user's own lap
                userLapFoundOnPage = true;
            }
            description += `${line}\n`;
        }
    }

    embed.setDescription(description);

    // Fetch and display user's best lap if not on the current page
    if (!userLapFoundOnPage && requestingUserId) {
         let userLapQuery = `
            WITH RankedLaps AS (
                SELECT
                    discord_tag,
                    lap_time,
                    user_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id, track_location_name
                        ORDER BY
                            CASE
                                WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                                    SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                    SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                    SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                                WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                                    SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                    SPLIT_PART(lap_time, '.', 2)::INT
                                ELSE 999999999
                            END ASC,
                            submission_date ASC
                    ) as rn
                FROM hotlaps
                WHERE guild_id = $1 AND track_location_name ILIKE $2 AND is_valid = TRUE AND user_id = $3
            ),
            GlobalRankedLaps AS (
                SELECT
                    discord_tag,
                    lap_time,
                    user_id,
                    ROW_NUMBER() OVER (
                        ORDER BY
                            CASE
                                WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                                    SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                    SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                    SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                                WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                                    SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                    SPLIT_PART(lap_time, '.', 2)::INT
                                ELSE 999999999
                            END ASC
                    ) as global_rank
                FROM RankedLaps
                WHERE rn = 1
            )
            SELECT
                discord_tag,
                lap_time,
                user_id,
                global_rank
            FROM GlobalRankedLaps;
         `;
         const userLapParams = [guildId, trackName, requestingUserId];
         if (customSetupOnly) {
            userLapQuery = userLapQuery.replace('WHERE rn = 1', 'WHERE rn = 1 AND custom_setup = TRUE');
         }

         const userLapResult = await db.query(userLapQuery, userLapParams);
         if (userLapResult.rows.length > 0) {
             const userBestLapData = userLapResult.rows[0];
             embed.addFields({
                 name: 'Your Best Lap',
                 value: `✨ **${userBestLapData.global_rank}. ${userBestLapData.discord_tag}** - \`${userBestLapData.lap_time}\``,
                 inline: false
             });
         }
    }


    // Add a field for a link to the full web leaderboard (if you have one)
    const webLeaderboardBaseUrl = process.env.WEB_FRONTEND_URL || 'YOUR_FRONTEND_BASE_URL';
    if (webLeaderboardBaseUrl !== 'YOUR_FRONTEND_BASE_URL') {
        const encodedTrackName = encodeURIComponent(trackName);
        const fullLeaderboardLink = `${webLeaderboardBaseUrl}/leaderboard?guildId=${guildId}&track=${encodedTrackName}`;
        embed.addFields({
            name: '🌐 Full Leaderboard',
            value: `[View all laps on the web](${fullLeaderboardLink})`,
            inline: false
        });
    }

    // Create pagination buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_previous')
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 1), // Disable if on the first page
            new ButtonBuilder()
                .setCustomId('leaderboard_next')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages || totalPages === 0) // Disable if on last page or no laps
        );

    return { embed, row, page, totalPages };
}


module.exports = {
    // Defines the slash command structure
    data: new SlashCommandBuilder()
        .setName('f1-leaderboard')
        .setDescription('Displays the F1 hotlap leaderboard for a selected track.')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('Select a track to view the leaderboard.')
                .setRequired(true)
                .setAutocomplete(true) // Enables autocomplete for track names
        )
        .addBooleanOption(option =>
            option.setName('custom_setup_only')
                .setDescription('Show only laps with custom setup (True/False).')
                .setRequired(false) // Optional filter
        )
        .addNumberOption(option => // New option for pagination
            option.setName('page')
                .setDescription('Page number to view (e.g., 1, 2, 3...)')
                .setRequired(false)
        ),

    // Handles autocomplete interactions for the 'track' option
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.respond([]);
            return;
        }

        try {
            const result = await db.query(
                `SELECT DISTINCT track_location_name FROM hotlaps WHERE guild_id = $1 AND track_location_name ILIKE $2 ORDER BY track_location_name ASC;`,
                [guildId, `%${focusedValue}%`]
            );

            const choices = result.rows.map(row => ({
                name: row.track_location_name,
                value: row.track_location_name
            }));

            await interaction.respond(choices);
        } catch (error) {
            console.error('❌ Error during leaderboard autocomplete:', error);
            await interaction.respond([]);
        }
    },

    // Handles the execution of the leaderboard command
    async execute(interaction) {
        await interaction.deferReply();

        const trackName = interaction.options.getString('track');
        const customSetupOnly = interaction.options.getBoolean('custom_setup_only') || false;
        let currentPage = interaction.options.getNumber('page') || 1;
        const guildId = interaction.guildId;
        const requestingUserId = interaction.user.id;

        if (!guildId) {
            return interaction.editReply('This command can only be used in a server.');
        }

        try {
            // Get initial embed and buttons
            let { embed, row, page, totalPages } = await getLeaderboardEmbed(guildId, trackName, customSetupOnly, currentPage, requestingUserId);

            // Send the initial reply with embed and buttons
            const message = await interaction.editReply({ embeds: [embed], components: [row] });

            // Create a collector for button interactions
            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === requestingUserId && ['leaderboard_previous', 'leaderboard_next'].includes(i.customId),
                time: 60 * 1000, // Collector expires after 60 seconds of inactivity
            });

            collector.on('collect', async i => {
                await i.deferUpdate(); // Acknowledge the button press

                if (i.customId === 'leaderboard_previous') {
                    currentPage--;
                } else if (i.customId === 'leaderboard_next') {
                    currentPage++;
                }

                // Re-fetch data and re-build embed/buttons for the new page
                const { embed: newEmbed, row: newRow } = await getLeaderboardEmbed(guildId, trackName, customSetupOnly, currentPage, requestingUserId);

                // Update the original message with the new embed and button states
                await i.editReply({ embeds: [newEmbed], components: [newRow] });
            });

            collector.on('end', async () => {
                // Disable buttons when the collector ends (e.g., after timeout)
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('leaderboard_previous_disabled')
                            .setLabel('⬅️ Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('leaderboard_next_disabled')
                            .setLabel('Next ➡️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true)
                    );
                // Fetch the current state of the message to update
                const currentMessage = await interaction.fetchReply();
                await currentMessage.edit({ components: [disabledRow] }).catch(console.error); // Catch potential errors if message was deleted
            });

        } catch (error) {
            console.error('❌ Error fetching leaderboard:', error);
            await interaction.editReply('There was an error trying to fetch the leaderboard. Please try again.');
        }
    },
};
