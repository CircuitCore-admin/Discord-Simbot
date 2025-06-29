// commands/analyze_hotlap.js
const { SlashCommandBuilder } = require('discord.js');
const analyzeImage = require('../services/analyzeImage');
const db = require('../services/database'); // Make sure you require your database connection

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analyze_hotlap')
        .setDescription('Analyze an F1 hotlap screenshot using Gemini AI')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Upload the screenshot of the hotlap')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const image = interaction.options.getAttachment('image');

        try {
            const analysisResult = await analyzeImage(image.url); // This now returns an object

            if (analysisResult.status === 'incomplete') {
                return interaction.editReply(`⚠️ ${analysisResult.message}. Please upload a full screenshot showing ALL required sections and columns (Track Location, Driver, Team, Time, S1, S2, S3, PEN., Custom Setup, Assists).`);
            } else if (analysisResult.status === 'complete') {
                // Extract data for database insertion
                const guildId = interaction.guildId;
                const channelId = interaction.channelId;
                const messageId = interaction.id; // Interaction ID can serve as a unique identifier for the command use
                const userId = interaction.user.id;
                const discordTag = interaction.user.tag; // Get the Discord tag here

                const driverName = analysisResult.driver_name;
                const teamName = analysisResult.team_name;
                const lapTime = analysisResult.lap_time;
                const s1Time = analysisResult.s1_time;
                const s2Time = analysisResult.s2_time;
                const s3Time = analysisResult.s3_time;
                const isValid = analysisResult.is_valid; // This will be true/false
                // Convert custom_setup string ("Yes"/"No") to boolean
                const customSetupBoolean = analysisResult.custom_setup === 'Yes' ? true : false;
                const trackLocationName = analysisResult.track_location_name;
                const submissionDate = new Date(); // Current timestamp

                // Construct the reply message
                let replyContent = `📊 Hotlap Analysis for your image:\n`;
                replyContent += `Top Lap Time: ${lapTime}\n`;
                replyContent += `Valid: ${isValid ? '✅' : '❌'}\n`;
                replyContent += `Driver: ${driverName}\n`;
                replyContent += `Team: ${teamName}\n`;
                replyContent += `Track: ${trackLocationName}\n`;
                replyContent += `Sectors: S1: ${s1Time}, S2: ${s2Time}, S3: ${s3Time}\n`;
                replyContent += `Custom Setup: ${customSetupBoolean ? '✅ Yes' : '❌ No'}\n`; // Display boolean
                replyContent += `Notes: ${isValid ? 'None' : 'Penalty detected on fastest lap'}`; // Add notes based on validity

                // Insert into the database - UPDATED COLUMNS AND PARAMETERS
                await db.query(
                    `INSERT INTO hotlaps (guild_id, channel_id, message_id, user_id, discord_tag, driver_name, team_name, lap_time, s1_time, s2_time, s3_time, is_valid, custom_setup, track_location_name, submission_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
                    [
                        guildId, channelId, messageId, userId, discordTag, // Added discordTag
                        driverName, teamName, lapTime,
                        s1Time, s2Time, s3Time, isValid,
                        customSetupBoolean, // Use converted boolean value
                        trackLocationName, submissionDate
                    ]
                );

                return interaction.editReply(`\`\`\`\n${replyContent}\n\`\`\`\nYour hotlap has been recorded!`);

            } else {
                // Fallback for unexpected analysisResult.status
                console.error('❌ Unexpected analysis status from Gemini:', analysisResult.status);
                return interaction.editReply('⚠️ Something went wrong during analysis. Unexpected AI response.');
            }

        } catch (err) {
            console.error('❌ Command Error:', err);
            // Provide a more user-friendly error message
            if (err.message.includes('AI analysis failed to return valid data')) {
                return interaction.editReply(`⚠️ Sorry, I couldn't understand the image properly. Please ensure the screenshot is clear and correctly formatted. Error: ${err.message}`);
            } else if (err.message.includes('Failed to analyze image with AI')) {
                return interaction.editReply(`⚠️ An error occurred while communicating with the AI. Please try again later. Error: ${err.message}`);
            } else {
                return interaction.editReply(`⚠️ Something went wrong while analyzing the screenshot: ${err.message || 'An unknown error occurred.'}`);
            }
        }
    }
};