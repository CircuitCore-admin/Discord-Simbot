// commands/submit_hotlap.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit_hotlap')
        .setDescription('Manually submit a hotlap with all data')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('Track location name (e.g., BELGIUM, TEXAS)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('driver_name')
                .setDescription('Driver name (the person who set the lap time)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('team')
                .setDescription('F1 2025 team')
                .setRequired(true)
                .addChoices(
                    { name: 'Red Bull Racing', value: 'Red Bull Racing' },
                    { name: 'Ferrari', value: 'Ferrari' },
                    { name: 'Mercedes', value: 'Mercedes' },
                    { name: 'McLaren', value: 'McLaren' },
                    { name: 'Aston Martin', value: 'Aston Martin' },
                    { name: 'Alpine', value: 'Alpine' },
                    { name: 'Williams', value: 'Williams' },
                    { name: 'RB', value: 'RB' },
                    { name: 'Kick Sauber', value: 'Kick Sauber' },
                    { name: 'Haas', value: 'Haas' }
                )
        )
        .addStringOption(option =>
            option.setName('lap_time')
                .setDescription('Lap time (e.g., 1:49.631)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('s1_time')
                .setDescription('Sector 1 time (e.g., 35.123)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('s2_time')
                .setDescription('Sector 2 time (e.g., 38.456)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('s3_time')
                .setDescription('Sector 3 time (e.g., 36.052)')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('custom_setup')
                .setDescription('Was a custom setup used?')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Extract data from interaction options
            const guildId = interaction.guildId;
            const channelId = interaction.channelId;
            const messageId = interaction.id;
            const userId = interaction.user.id;
            const adminDiscordTag = interaction.user.tag; // Admin who submitted

            // Get command options
            const driverName = interaction.options.getString('driver_name');
            const trackLocationName = interaction.options.getString('track');
            const teamName = interaction.options.getString('team');
            const lapTime = interaction.options.getString('lap_time');
            const s1Time = interaction.options.getString('s1_time');
            const s2Time = interaction.options.getString('s2_time');
            const s3Time = interaction.options.getString('s3_time');
            const customSetup = interaction.options.getBoolean('custom_setup');
            const isValid = true; // Always valid since admins won't submit invalid laps

            // Use driver_name for discord_tag since driver doesn't have Discord
            const discordTag = driverName;

            const submissionDate = new Date();

            // Validate lap time format (basic check) - allows multi-digit minutes
            const lapTimePattern = /^\d+:\d{2}\.\d{3}$/;
            if (!lapTimePattern.test(lapTime)) {
                return interaction.editReply('❌ Invalid lap time format. Please use format like "1:49.631" (M:SS.mmm)');
            }

            // Validate sector time formats (basic check)
            const sectorTimePattern = /^\d+\.\d{3}$/;
            if (!sectorTimePattern.test(s1Time) || !sectorTimePattern.test(s2Time) || !sectorTimePattern.test(s3Time)) {
                return interaction.editReply('❌ Invalid sector time format. Please use format like "35.123" (SS.mmm)');
            }

            // Insert into the database
            await db.query(
                `INSERT INTO hotlaps (guild_id, channel_id, message_id, user_id, discord_tag, driver_name, team_name, lap_time, s1_time, s2_time, s3_time, is_valid, custom_setup, track_location_name, submission_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
                [
                    guildId, channelId, messageId, userId, discordTag,
                    driverName, teamName, lapTime,
                    s1Time, s2Time, s3Time, isValid,
                    customSetup,
                    trackLocationName, submissionDate
                ]
            );

            // Construct the reply message
            let replyContent = `📊 Hotlap Manually Submitted:\n`;
            replyContent += `Driver: ${driverName}\n`;
            replyContent += `Team: ${teamName}\n`;
            replyContent += `Track: ${trackLocationName}\n`;
            replyContent += `Lap Time: ${lapTime}\n`;
            replyContent += `Sectors: S1: ${s1Time}, S2: ${s2Time}, S3: ${s3Time}\n`;
            replyContent += `Custom Setup: ${customSetup ? '✅ Yes' : '❌ No'}\n`;
            replyContent += `Submitted by: ${adminDiscordTag}`;

            return interaction.editReply(`\`\`\`\n${replyContent}\n\`\`\`\nHotlap recorded successfully!`);

        } catch (err) {
            console.error('❌ Command Error:', err);
            return interaction.editReply(`⚠️ Something went wrong while submitting the hotlap: ${err.message || 'An unknown error occurred.'}`);
        }
    }
};
