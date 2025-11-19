// commands/upload_hotlap.js
const { SlashCommandBuilder } = require('discord.js');
const { analyzeAndSaveHotlap } = require('../services/analyzeImage');
const db = require('../services/database');
const { formatChannelName } = require('../helpers/formatters');

const SPECIAL_GUILD_ID = '1042747615856562187';
const STAFF_ROLE_ID = '1049283555479539712';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload_hotlap')
        .setDescription('Upload a hotlap image for analysis (Staff can override driver name)')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription(' The leaderboard screenshot')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('driver_name')
                .setDescription('Override Driver Name (Centre Staff Only)')
                .setAutocomplete(true)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'driver_name') {
            try {
                const query = `
                    SELECT DISTINCT discord_tag 
                    FROM hotlaps 
                    WHERE guild_id = $1 
                    AND discord_tag ILIKE $2 
                    LIMIT 25
                `;
                const result = await db.query(query, [SPECIAL_GUILD_ID, `%${focusedOption.value}%`]);
                
                const choices = result.rows.map(row => row.discord_tag);
                await interaction.respond(
                    choices.map(choice => ({ name: choice, value: choice }))
                );
            } catch (err) {
                console.error('Error in driver_name autocomplete:', err);
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const imageAttachment = interaction.options.getAttachment('image');
            let driverOverride = interaction.options.getString('driver_name');

            // --- ROLE CHECK FOR DRIVER OVERRIDE ---
            if (driverOverride) {
                const hasStaffRole = interaction.member.roles.cache.has(STAFF_ROLE_ID);
                
                if (!hasStaffRole) {
                    console.log(`User ${interaction.user.tag} tried to override driver name without staff role. Ignoring override.`);
                    driverOverride = null; 
                }
            }

            // --- CENTRE NAME LOGIC ---
            let centreName = null;
            if (interaction.guild.id === SPECIAL_GUILD_ID) {
                if (interaction.channel.parentId) {
                    const categoriesQuery = await db.query('SELECT 1 FROM public.special_hotlap_categories WHERE category_id = $1', [interaction.channel.parentId]);
                    if (categoriesQuery.rows.length > 0) {
                        centreName = formatChannelName(interaction.channel.name);
                        console.log(`Auto-detected centre from channel: ${centreName}`);
                    }
                }
            }

            // Pass NULL for manualData
            // Pass driverOverride (if valid) and imageAttachment
            await analyzeAndSaveHotlap(
                interaction, 
                null, 
                centreName, 
                driverOverride, 
                imageAttachment
            );

        } catch (error) {
            console.error('Error in upload_hotlap command:', error);
            await interaction.editReply({ content: `An error occurred: ${error.message}` });
        }
    },
};