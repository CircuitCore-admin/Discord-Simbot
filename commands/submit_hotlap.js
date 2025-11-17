// commands/submit_hotlap.js
const { SlashCommandBuilder, ChannelType } = require('discord.js');
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
        .setName('submit_hotlap')
        .setDescription('Manually submit a hotlap with all data')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('Track location name (e.g., BELGIUM, TEXAS)')
                .setRequired(true)
                .setAutocomplete(true)
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

        if (focusedOption.name === 'track') {
            const trackQuery = 'SELECT DISTINCT track_location_name FROM hotlaps WHERE track_location_name ILIKE $1 LIMIT 25';
            const queryResult = await db.query(trackQuery, [`%${focusedOption.value}%`]);
            choices = queryResult.rows.map(row => row.track_location_name);
            const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice })).slice(0, 25)
            );
        }

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
            // Validate lap time format (basic check) - allows multi-digit minutes
            const lapTime = interaction.options.getString('lap_time');
            const lapTimePattern = /^\d+:\d{2}\.\d{3}$/;
            if (!lapTimePattern.test(lapTime)) {
                return interaction.editReply('❌ Invalid lap time format. Please use format like "1:49.631" (M:SS.mmm)');
            }

            // Validate sector time formats (basic check)
            const s1Time = interaction.options.getString('s1_time');
            const s2Time = interaction.options.getString('s2_time');
            const s3Time = interaction.options.getString('s3_time');
            const sectorTimePattern = /^\d+\.\d{3}$/;
            if (!sectorTimePattern.test(s1Time) || !sectorTimePattern.test(s2Time) || !sectorTimePattern.test(s3Time)) {
                return interaction.editReply('❌ Invalid sector time format. Please use format like "35.123" (SS.mmm)');
            }

            const manualData = {
                trackName: interaction.options.getString('track'),
                driverName: interaction.options.getString('driver_name'),
                discordTagOverride: interaction.options.getString('driver_name'), // Use driver name for discord_tag on leaderboard
                teamName: interaction.options.getString('team'),
                lapTime: lapTime,
                s1: s1Time,
                s2: s2Time,
                s3: s3Time,
                isValid: true, // Always valid since admins won't submit invalid laps
                isCustom: interaction.options.getBoolean('custom_setup'),
            };

            // Auto-detect centre name from channel if in special guild
            let centreName = null;
            if (interaction.guild.id === SPECIAL_GUILD_ID) {
                // Check if channel is in one of the designated categories
                const categoriesQuery = await db.query('SELECT 1 FROM public.special_hotlap_categories WHERE category_id = $1', [interaction.channel.parentId]);
                if (categoriesQuery.rows.length > 0) {
                    centreName = formatChannelName(interaction.channel.name);
                }
                
                // Also check for manual centre override (if provided)
                const centreSlug = interaction.options.getString('centre');
                if (centreSlug) {
                    centreName = formatChannelName(centreSlug);
                }
            }

            // Pass centreName as the third argument
            await analyzeAndSaveHotlap(interaction, manualData, centreName);

        } catch (error) {
            console.error('Error in submit_hotlap command:', error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};
