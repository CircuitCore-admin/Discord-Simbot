const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🧹 Clearing all commands...');
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] });
        console.log('✅ Successfully cleared commands.');

        const commands = [
            {
                name: 'test',
                description: 'Test command to check bot response',
            },
            {
                name: 'driver_stats',
                description: 'Get detailed stats for a specific driver',
                options: [
                    {
                        name: 'driver_name',
                        type: 3, // STRING type
                        description: 'Name of the driver',
                        required: true,
                    },
                ],
            },
            {
                name: 'driver_laps',
                description: 'Get all laps, lap times, and validity for a specific driver',
                options: [
                    {
                        name: 'driver_name',
                        type: 3, // STRING type
                        description: 'Name of the driver',
                        required: true,
                    },
                ],
            },
        ];

        console.log('🔄 Redeploying commands...');
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log('✅ Commands re-registered successfully.');
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
    }
})();
