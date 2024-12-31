const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');

// Utility function to format dates
function formatShortDate(dateString) {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(2)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('View results from a specific session')
        .addStringOption(option =>
            option.setName('session')
                .setDescription('Select a session')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    // Autocomplete Handler
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const result = await db.query(`
                SELECT session_type, session_name, session_date 
                FROM session_info
                WHERE CONCAT(session_type, ' | ', session_name, ' | ', TO_CHAR(session_date, 'DD/MM/YY HH24:MI')) ILIKE $1
                ORDER BY session_date DESC
                LIMIT 25;
            `, [`%${focusedValue}%`]);

            const choices = result.rows.map(row => ({
                name: `${row.session_type} | ${row.session_name} | ${formatShortDate(row.session_date)}`,
                value: `${row.session_type}|${row.session_name}|${row.session_date}`
            }));

            await interaction.respond(choices);
        } catch (error) {
            console.error('❌ Autocomplete Error:', error);
            await interaction.respond([]);
        }
    },

    // Command Execution Handler
    async execute(interaction) {
        const selectedSession = interaction.options.getString('session');
        const [sessionType, sessionName, sessionDate] = selectedSession.split('|');

        try {
            const results = await db.query(`
                SELECT d.real_name, r.position, r.lap_time, r.total_time
                FROM results r
                JOIN driver_info d ON r.steam_id = d.steam_id
                WHERE r.session_type = $1 AND r.session_name = $2 AND r.session_date = $3
                ORDER BY r.position ASC;
            `, [sessionType.trim(), sessionName.trim(), sessionDate.trim()]);

            if (results.rows.length === 0) {
                return await interaction.reply({
                    content: 'No results found for the selected session.',
                    ephemeral: true
                });
            }

            // Build Embed Message
            const embed = new EmbedBuilder()
                .setTitle(`${sessionType.trim()} | ${sessionName.trim()} | ${formatShortDate(sessionDate.trim())}`)
                .setColor(0x00FF00)
                .setDescription(
                    results.rows.map((row, index) => 
                        `**#${row.position}** - **${row.real_name}** | Lap Time: ${row.lap_time || 'N/A'} | Total Time: ${row.total_time || 'N/A'}`
                    ).join('\n')
                )
                .setFooter({ text: 'Powered by CircuitCore' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error fetching results:', error);
            await interaction.reply({
                content: 'An error occurred while fetching the results. Please try again later.',
                ephemeral: true
            });
        }
    }
};
