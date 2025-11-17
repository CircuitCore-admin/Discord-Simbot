// commands/upload_hotlap.js
const { SlashCommandBuilder, ChannelType } = require('discord.js');
const analyzeImage = require('../services/analyzeImage');
const { analyzeAndSaveHotlap } = require('../services/analyzeImage');
const db = require('../services/database');
const { formatChannelName } = require('../helpers/formatters');

const SPECIAL_GUILD_ID = '1042747615856562187';

// Helper function for this command's autocomplete
async function getSpecialChannelsForGuild(client, guildId) {
    try {
        const guild = await client.guilds.fetch(guildId);
        const categoriesQuery = await db.query('SELECT category_id FROM public.special_hotlap_categories');
        if (categoriesQuery.rows.length === 0) return [];

        const categoryIds = categoriesQuery.rows.map(r => r.category_id);
        let textChannels = [];

        for (const categoryId of categoryIds) {
            const category = await guild.channels.fetch(categoryId).catch(() => null);
            if (category && category.type === ChannelType.GuildCategory && category.children) {
                const channelsInCategory = category.children.cache.filter(ch => ch.type === ChannelType.GuildText);
                textChannels = textChannels.concat(Array.from(channelsInCategory.values()));
            }
        }
        return textChannels;
    } catch (error) {
        console.error(`Error fetching special channels for ${guildId}:`, error);
        return [];
    }
}

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
        )
        .addStringOption(option =>
            option.setName('centre')
                .setDescription('The centre you are racing for (Special Guild Only)')
                .setAutocomplete(true)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];

        if (focusedOption.name === 'centre') {
            if (interaction.guild.id === SPECIAL_GUILD_ID) {
                const channels = await getSpecialChannelsForGuild(interaction.client, interaction.guild.id);
                choices = channels.map(ch => ({
                    name: formatChannelName(ch.name), // "Confetti Institute"
                    value: ch.name  // "confetti-institute"
                }));
            }
            // If not special guild, choices remains empty
            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())
            );
            await interaction.respond(filtered.slice(0, 25));
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const image = interaction.options.getAttachment('image');
            const manualDriverName = interaction.options.getString('driver_name');
            
            // Validate that the attachment is an image
            if (!image.contentType || !image.contentType.startsWith('image/')) {
                return interaction.editReply('❌ Please upload a valid image file.');
            }

            // Mark this interaction as being processed by a command
            // This will be checked in the messageCreate listener to prevent double logging
            interaction.isCommandProcessed = true;

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

            // Override the driver name with manual input
            const manualData = {
                trackName: analysisResult.track_location_name,
                driverName: manualDriverName, // Use manual driver name override
                teamName: analysisResult.team_name,
                lapTime: analysisResult.lap_time,
                s1: analysisResult.s1_time,
                s2: analysisResult.s2_time,
                s3: analysisResult.s3_time,
                isValid: analysisResult.is_valid,
                isCustom: analysisResult.custom_setup === 'Yes' ? true : false,
            };

            // Get and format centre name
            const centreSlug = interaction.options.getString('centre');
            let centreName = null;
            if (interaction.guild.id === SPECIAL_GUILD_ID && centreSlug) {
                centreName = formatChannelName(centreSlug);
            }

            // Pass centreName as the third argument
            await analyzeAndSaveHotlap(interaction, manualData, centreName);

        } catch (error) {
            console.error('Error in upload_hotlap command:', error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};
