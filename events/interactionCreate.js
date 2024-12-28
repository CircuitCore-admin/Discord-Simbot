module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            // Handle Slash Commands
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                console.log(`🚀 Executing command: ${interaction.commandName}`);
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Error executing command:', error);
                await interaction.reply({
                    content: 'There was an error executing that command.',
                    ephemeral: true,
                });
            }
        } else if (interaction.isAutocomplete()) {
            // Handle Autocomplete
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                console.log(`🔄 Handling autocomplete for: ${interaction.commandName}`);
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                } else {
                    console.warn(`⚠️ No autocomplete handler defined for: ${interaction.commandName}`);
                }
            } catch (error) {
                console.error('❌ Error handling autocomplete:', error);
                await interaction.respond([]);
            }
        }
    },
};
