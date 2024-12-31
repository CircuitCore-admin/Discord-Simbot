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
                name: 'leaderboard',
                description: 'Get the fastest lap times for a specific track',
                options: [
                    {
                        name: 'track',
                        type: 3, // STRING
                        description: 'Select a track to view the leaderboard',
                        required: true,
                        autocomplete: true,
                    }
                ],
            },
            {
                name: 'results',
                description: 'View results from a specific session',
                options: [
                    {
                        name: 'session',
                        type: 3, // STRING
                        description: 'Select a session',
                        required: true,
                        autocomplete: true
                    }
                ]
            },            
            {
                name: 'car',
                description: 'Get driver-specific stats for a selected car model',
                options: [
                    {
                        name: 'car_model',
                        type: 3, // STRING
                        description: 'Select a car model (e.g., Ferrari 296 GT3 2023)',
                        required: true,
                        autocomplete: true
                    },
                    {
                        name: 'user',
                        type: 6, // USER
                        description: 'Mention another user to view their car stats (optional)',
                        required: false
                    }
                ]
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
            },
            {
                name: 'driver_track',
                description: 'Get driver-specific stats for a specific track',
                options: [
                    {
                        name: 'user',
                        type: 6, // USER type
                        description: 'Mention the Discord user',
                        required: true,
                    },
                    {
                        name: 'track',
                        type: 3, // STRING type
                        description: 'Specify the track ID (e.g., spa)',
                        required: true,
                    }
                ],
            },
            {
                name: 'driver_car_track',
                description: 'Get driver-specific stats for a track and car model',
                options: [
                    {
                        name: 'track',
                        type: 3, // STRING
                        description: 'Specify the track ID (e.g., spa)',
                        required: true,
                        autocomplete: true,
                    },
                    {
                        name: 'car_model',
                        type: 3, // STRING
                        description: 'Specify the car model (e.g., GT3)',
                        required: true,
                        autocomplete: true,
                    },
                    {
                        name: 'user',
                        type: 6, // USER
                        description: 'Mention another Discord user (optional)',
                        required: false,
                    }
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
                description: 'Register or update a driver with Discord ID and Steam ID',
                options: [
                    {
                        name: 'steam_input',
                        type: 3, // STRING type
                        description: 'Steam Profile Link or Vanity Username',
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
            // {
            //     name: 'driver_info',
            //     description: 'Get details about a specific driver or auto-register them if not fully registered',
            //     options: [
            //         {
            //             name: 'user',
            //             type: 6, // USER type
            //             description: 'Mention the Discord user',
            //             required: false,
            //         },
            //         {
            //             name: 'driver_name',
            //             type: 3, // STRING type
            //             description: 'Search by Driver Real Name',
            //             required: false,
            //         }
            //     ],
            // },
            {
                name: 'add_track',
                description: 'Add a new track to the database',
                default_member_permissions: 0,
                options: [
                    {
                        name: 'track_id',
                        type: 3, // STRING
                        description: 'Unique track identifier (e.g., red_bull_ring)',
                        required: true,
                    },
                    {
                        name: 'track_name',
                        type: 3, // STRING
                        description: 'Name of the track',
                        required: true,
                    },
                    {
                        name: 'location',
                        type: 3, // STRING
                        description: 'Location of the track',
                        required: true,
                    },
                    {
                        name: 'track_length',
                        type: 10, // NUMBER
                        description: 'Length of the track in kilometers or meters',
                        required: true,
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
