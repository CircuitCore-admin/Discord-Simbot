// File: commands/manage_special_category.js
const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const db = require('../services/database'); // Adjust path as needed

const SPECIAL_GUILD_ID = '1042747615856562187';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage_special_category')
        .setDescription('Manages the hotlap categories for this server.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adds a category for hotlap scanning.')
                .addChannelOption(option => 
                    option.setName('category')
                        .setDescription('The category to add')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes a category from hotlap scanning.')
                .addChannelOption(option => 
                    option.setName('category')
                        .setDescription('The category to remove')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all scannable hotlap categories.')),
    async execute(interaction) {
        if (interaction.guild.id !== SPECIAL_GUILD_ID) {
            return interaction.reply({ content: 'This command can only be used in the designated special guild.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const category = interaction.options.getChannel('category');

        try {
            await interaction.deferReply({ ephemeral: true });

            if (subcommand === 'add') {
                await db.query('INSERT INTO public.special_hotlap_categories (category_id) VALUES ($1) ON CONFLICT (category_id) DO NOTHING', [category.id]);
                await interaction.editReply({ content: `Category \`${category.name}\` is now being scanned for hotlaps.` });
            } else if (subcommand === 'remove') {
                const res = await db.query('DELETE FROM public.special_hotlap_categories WHERE category_id = $1', [category.id]);
                if (res.rowCount > 0) {
                    await interaction.editReply({ content: `Category \`${category.name}\` is no longer being scanned.` });
                } else {
                    await interaction.editReply({ content: `Category \`${category.name}\` was not in the list.` });
                }
            } else if (subcommand === 'list') {
                const res = await db.query('SELECT category_id FROM public.special_hotlap_categories');
                if (res.rows.length === 0) {
                    await interaction.editReply({ content: 'This guild has no special categories configured.' });
                    return;
                }
                const categoryList = res.rows.map(r => `• <#${r.category_id}> (\`${r.category_id}\`)`).join('\n');
                await interaction.editReply({ content: `**Special Hotlap Categories:**\n${categoryList}` });
            }
        } catch (error) {
            console.error('Error executing manage_special_category:', error);
            await interaction.editReply({ content: 'An error occurred while managing categories.' });
        }
    },
};
