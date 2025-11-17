// commands/upload_hotlap.js
// This command allows users to upload a hotlap image with manual driver name override.
// It analyzes the image to extract lap data but uses the manually provided driver name
// instead of the AI-detected name. This prevents double logging since slash commands
// create interactions, not messages, so they don't trigger the messageCreate listener.

const { SlashCommandBuilder } = require('discord.js');
const analyzeImage = require('../services/analyzeImage');
const { analyzeAndSaveHotlap } = require('../services/analyzeImage');
const db = require('../services/database');
const { formatChannelName } = require('../helpers/formatters');

const SPECIAL_GUILD_ID = '1042747615856562187';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload_hotlap')
        .setDescription('Upload a hotlap image with manual driver name override')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Upload the screenshot of the hotlap')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('driver_name')
                .setDescription('Override the driver name (the person who set the lap time)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const image = interaction.options.getAttachment('image');
            const manualDriverName = interaction.options.getString('driver_name');
            
            // Validate that the attachment is an image
            if (!image.contentType || !image.contentType.startsWith('image/')) {
                return interaction.editReply('❌ Please upload a valid image file.');
            }

            // Analyze the image
            await interaction.channel?.sendTyping();
            const analysisResult = await analyzeImage(image.url);

            if (analysisResult.status === 'incomplete') {
                return interaction.editReply(`⚠️ ${analysisResult.message}. Please upload a full screenshot showing the whole screen.`);
            } else if (analysisResult.status !== 'complete') {
                console.error('❌ Unexpected analysis status from Gemini:', analysisResult.status);
                return interaction.editReply('⚠️ Something went wrong during analysis. Unexpected AI response.');
            }

            // Reject invalid laps and stop processing
            if (!analysisResult.is_valid) {
                const trackName = analysisResult.track_location_name || 'Unknown Track';
                const time = analysisResult.lap_time || 'N/A';
                return interaction.editReply(`❌ Lap Rejected: The fastest lap (${time}) on ${trackName} is invalid due to a penalty. Only valid laps can be processed and recorded.`);
            }

            // Auto-detect centre name from channel if in special guild
            let centreName = null;
            if (interaction.guild.id === SPECIAL_GUILD_ID) {
                // Check if channel is in one of the designated categories
                const categoriesQuery = await db.query('SELECT 1 FROM public.special_hotlap_categories WHERE category_id = $1', [interaction.channel.parentId]);
                if (categoriesQuery.rows.length > 0) {
                    centreName = formatChannelName(interaction.channel.name);
                }
            }

            // Override the driver name with manual input
            // Also pass the manual driver name as discordTagOverride to be used for discord_tag field
            const manualData = {
                trackName: analysisResult.track_location_name,
                driverName: manualDriverName, // Use manual driver name override
                discordTagOverride: manualDriverName, // Also use it for discord_tag so it appears on leaderboard
                teamName: analysisResult.team_name,
                lapTime: analysisResult.lap_time,
                s1: analysisResult.s1_time,
                s2: analysisResult.s2_time,
                s3: analysisResult.s3_time,
                isValid: analysisResult.is_valid,
                isCustom: analysisResult.custom_setup === 'Yes' ? true : false,
            };

            // Pass centreName as the third argument
            await analyzeAndSaveHotlap(interaction, manualData, centreName);

        } catch (error) {
            console.error('Error in upload_hotlap command:', error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};
