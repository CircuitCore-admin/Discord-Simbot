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
            {
                name: 'register_driver',
                description: 'Register a driver with their ACC name and Steam ID or Steam Link',
                options: [
                    {
                        name: 'acc_name',
                        type: 3, // STRING type
                        description: 'ACC Driver Name',
                        required: true,
                    },
                    {
                        name: 'steam_input',
                        type: 3, // STRING type
                        description: 'Steam ID or Steam Profile Link',
                        required: true,
                    },
                ],
            },
            {
                name: 'upload_drivers',
                description: 'Upload a CSV file to add multiple drivers to the database',
                default_member_permissions: 0,
                options: [
                    {
                        name: 'file',
                        type: 11, // Attachment type
                        description: 'Upload a CSV file with driver details',
                        required: true,
                    },
                ],
            },
            {
                name: 'list_drivers',
                description: 'List all registered drivers in the database',
            },
            {
                name: 'driver_info',
                description: 'Get details about a specific driver or auto-register them if not fully registered',
                options: [
                    {
                        name: 'user',
                        type: 6, // USER type
                        description: 'Mention the Discord user',
                        required: false,
                    },
                    {
                        name: 'driver_name',
                        type: 3, // STRING type
                        description: 'Search by Driver Real Name',
                        required: false,
                    }
                ],
            }
        ];

        console.log('🔄 Redeploying commands...');
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log('✅ Commands re-registered successfully.');
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
    }
})();
