// commands/submit_hotlap.js
const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { analyzeAndSaveHotlap } = require('../services/analyzeImage');
const db = require('../services/database');
const { formatChannelName } = require('../helpers/formatters');

const SPECIAL_GUILD_ID = '1042747615856562187';

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
                .setAutocomplete(true)
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
        .addChannelOption(option =>
            option.setName('centre')
                .setDescription('Ping the centre channel you are racing for (Special Guild Only)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText) // Limit to text channels
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        
        try {
            if (focusedOption.name === 'track') {
                // Tracks can be global, or you can limit to guild if you only want tracks raced on this server
                // For now, keeping tracks global usually makes sense, but here is the guild filter just in case you want it consistency:
                // const trackQuery = 'SELECT DISTINCT track_location_name FROM hotlaps WHERE guild_id = $1 AND track_location_name ILIKE $2 LIMIT 25';
                // For now, leaving track global (driver names are the priority for filtering)
                const trackQuery = 'SELECT DISTINCT track_location_name FROM hotlaps WHERE track_location_name ILIKE $1 LIMIT 25';
                const queryResult = await db.query(trackQuery, [`%${focusedOption.value}%`]);
                const choices = queryResult.rows.map(row => row.track_location_name);
                
                await interaction.respond(
                    choices.map(choice => ({ name: choice, value: choice }))
                );
            }

            if (focusedOption.name === 'driver_name') {
                // UPDATED: Added "AND guild_id = $1" to only show drivers from the current server
                const driverQuery = 'SELECT DISTINCT discord_tag FROM hotlaps WHERE guild_id = $1 AND discord_tag ILIKE $2 LIMIT 25';
                const queryResult = await db.query(driverQuery, [interaction.guild.id, `%${focusedOption.value}%`]);
                const choices = queryResult.rows.map(row => row.discord_tag);
                
                await interaction.respond(
                    choices.map(choice => ({ name: choice, value: choice }))
                );
            }
        } catch (error) {
            console.error('Error in autocomplete:', error);
            try { await interaction.respond([]); } catch (e) {}
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Validate lap time format
            const lapTime = interaction.options.getString('lap_time');
            const lapTimePattern = /^\d+:\d{2}\.\d{3}$/;
            if (!lapTimePattern.test(lapTime)) {
                return interaction.editReply('❌ Invalid lap time format. Please use format like "1:49.631" (M:SS.mmm)');
            }

            // Validate sector time formats
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
                teamName: interaction.options.getString('team'),
                lapTime: lapTime,
                s1: s1Time,
                s2: s2Time,
                s3: s3Time,
                isValid: true, 
                isCustom: interaction.options.getBoolean('custom_setup'),
            };

            // Logic for Centre Name
            let centreName = null;
            
            if (interaction.guild.id === SPECIAL_GUILD_ID) {
                // 1. Try auto-detect from channel category first
                if (interaction.channel.parentId) {
                    const categoriesQuery = await db.query('SELECT 1 FROM public.special_hotlap_categories WHERE category_id = $1', [interaction.channel.parentId]);
                    if (categoriesQuery.rows.length > 0) {
                        centreName = formatChannelName(interaction.channel.name);
                    }
                }
                
                // 2. Fallback to manual "Ping" selection if auto-detect didn't work
                if (!centreName) {
                    const centreChannel = interaction.options.getChannel('centre');
                    if (centreChannel) {
                        // formatChannelName converts "confetti-institute" -> "Confetti Institute"
                        centreName = formatChannelName(centreChannel.name);
                    }
                }
            }

            await analyzeAndSaveHotlap(interaction, manualData, centreName);

        } catch (error) {
            console.error('Error in submit_hotlap command:', error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};