const { REST, Routes, PermissionFlagsBits } = require('discord.js');
require('dotenv').config(); // Make sure this is at the very top to load environment variables first
const fs = require('fs');

// --- Environment Variable Checks ---
const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // This will be used for optional guild-specific deployment

if (!discordToken) {
    console.error('❌ DISCORD_TOKEN not found in .env file. Please ensure it is set.');
    process.exit(1); // Exit if critical env var is missing
}
if (!clientId) {
    console.error('❌ DISCORD_CLIENT_ID not found in .env file. Global commands cannot be deployed without it.');
    process.exit(1); // Exit if critical env var is missing
}

const rest = new REST({ version: '10' }).setToken(discordToken);

(async () => {
    try {
        const commands = [
            // {
            //     name: 'analyze_hotlap',
            //     description: 'Analyze an F1 hotlap screenshot using OCR and GPT-4',
            //     options: [
            //         {
            //             name: 'image',
            //             type: 11, // Attachment
            //             description: 'Upload the screenshot of the hotlap',
            //             required: true,
            //         },
            //     ],
            // },
            {
                name: 'edit',
                description: 'Edit an existing hotlap record',
                options: [
                    {
                        name: 'track_location',
                        type: 3, // STRING
                        description: 'The name of the track location',
                        required: true,
                        autocomplete: true,
                    },
                    {
                        name: 'name',
                        type: 3, // STRING
                        description: 'The Discord tag of the user whose lap needs editing',
                        required: true,
                        autocomplete: true,
                    },
                    {
                        name: 'time',
                        type: 3, // STRING
                        description: 'The exact lap time string (e.g., "1:27.705")',
                        required: true,
                        autocomplete: true,
                    },
                ],
                default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
                dm_permission: false, // Command cannot be used in DMs
            },
            {
                name: 'set_hotlap_channel',
                description: 'Sets the channel where hotlap screenshots will be automatically analyzed.',
                options: [
                    {
                        name: 'channel',
                        type: 7, // CHANNEL type
                        description: 'The channel to designate for hotlap submissions.',
                        required: true,
                        channel_types: [0], // 0 is GuildText
                    },
                ],
                default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
                setDMPermission: false, // Command cannot be used in DMs
            },
            // {
            //     name: 'f1-leaderboard',
            //     description: 'Displays the F1 hotlap leaderboard for a selected track.',
            //     options: [
            //         {
            //             name: 'track',
            //             type: 3, // STRING type
            //             description: 'Select a track to view the leaderboard.',
            //             required: true,
            //             autocomplete: true, // This enables dynamic suggestions for tracks
            //         },
            //         {
            //             name: 'custom_setup_only',
            //             type: 5, // BOOLEAN type
            //             description: 'Show only laps with custom setup (True/False).',
            //             required: false, // Optional filter
            //         }
            //     ],
            // },
            {
                name: 'submit_hotlap',
                description: 'Manually submit a hotlap with all data',
                options: [
                    {
                        name: 'driver_name',
                        type: 3, // STRING
                        description: 'Driver name (the person who set the lap time)',
                        required: true,
                    },
                    {
                        name: 'team',
                        type: 3, // STRING
                        description: 'F1 2025 team',
                        required: true,
                        choices: [
                            { name: 'Oracle Red Bull Racing', value: 'Oracle Red Bull Racing' },
                            { name: 'Scuderia Ferrari', value: 'Scuderia Ferrari' },
                            { name: 'Mercedes-AMG Petronas Formula One Team', value: 'Mercedes-AMG Petronas Formula One Team' },
                            { name: 'McLaren F1 Team', value: 'McLaren F1 Team' },
                            { name: 'Aston Martin Aramco F1 Team', value: 'Aston Martin Aramco F1 Team' },
                            { name: 'BWT Alpine F1 Team', value: 'BWT Alpine F1 Team' },
                            { name: 'Atlassian Williams Racing', value: 'Atlassian Williams Racing' },
                            { name: 'Visa Cash App Racing Bulls F1 Team', value: 'Visa Cash App Racing Bulls F1 Team' },
                            { name: 'Stake F1 Team Kick Sauber', value: 'Stake F1 Team Kick Sauber' },
                            { name: 'MoneyGram Haas F1 Team', value: 'MoneyGram Haas F1 Team' }
                        ],
                    },
                    {
                        name: 'track',
                        type: 3, // STRING
                        description: 'Track location name (e.g., BELGIUM, TEXAS)',
                        required: true,
                    },
                    {
                        name: 'lap_time',
                        type: 3, // STRING
                        description: 'Lap time (e.g., 1:49.631)',
                        required: true,
                    },
                    {
                        name: 's1_time',
                        type: 3, // STRING
                        description: 'Sector 1 time (e.g., 35.123)',
                        required: true,
                    },
                    {
                        name: 's2_time',
                        type: 3, // STRING
                        description: 'Sector 2 time (e.g., 38.456)',
                        required: true,
                    },
                    {
                        name: 's3_time',
                        type: 3, // STRING
                        description: 'Sector 3 time (e.g., 36.052)',
                        required: true,
                    },
                    {
                        name: 'custom_setup',
                        type: 5, // BOOLEAN
                        description: 'Was a custom setup used?',
                        required: true,
                    },
                ],
                default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
                dm_permission: false, // Command cannot be used in DMs
            },
            // The following commands were present in your previous deploy-commands.js.
            // Uncomment them if they are part of your bot's functionality.
            // {
            //     name: 'results',
            //     description: 'View results from a specific session',
            //     options: [
            //         {
            //             name: 'session',
            //             type: 3, // STRING
            //             description: 'Select a session',
            //             required: true,
            //             autocomplete: true
            //         }
            //     ]
            // },
            // {
            //     name: 'car',
            //     description: 'Get driver-specific stats for a selected car model',
            //     options: [
            //         {
            //             name: 'car_model',
            //             type: 3, // STRING
            //             description: 'Select a car model (e.g., Ferrari 296 GT3 2023)',
            //             required: true,
            //             autocomplete: true
            //         },
            //         {
            //             name: 'user',
            //             type: 6, // USER
            //             description: 'Mention another user to view their car stats (optional)',
            //             required: false
            //         }
            //     ]
            // },
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
            // {
            //     name: 'driver_track',
            //     description: 'Get driver-specific stats for a specific track',
            //     options: [
            //         {
            //             name: 'user',
            //             type: 6, // USER type
            //             description: 'Mention the Discord user',
            //             required: true,
            //         },
            //         {
            //             name: 'track',
            //             type: 3, // STRING type
            //             description: 'Specify the track ID (e.g., spa)',
            //             required: true,
            //         }
            //     ],
            // },
            // {
            //     name: 'driver_car_track',
            //     description: 'Get driver-specific stats for a track and car model',
            //     options: [
            //         {
            //             name: 'track',
            //             type: 3, // STRING
            //             description: 'Specify the track ID (e.g., spa)',
            //             required: true,
            //             autocomplete: true,
            //         },
            //         {
            //             name: 'car_model',
            //             type: 3, // STRING
            //             description: 'Specify the car model (e.g., GT3)',
            //             required: true,
            //             autocomplete: true,
            //         },
            //         {
            //             name: 'user',
            //             type: 6, // USER
            //             description: 'Mention another Discord user (optional)',
            //             required: false,
            //         }
            //     ],
            // },
            // {
            //     name: 'driver_laps',
            //     description: 'Get all laps, lap times, and validity for a specific driver',
            //     options: [
            //         {
            //             name: 'driver_name',
            //             type: 3, // STRING type
            //             description: 'Name of the driver',
            //             required: true,
            //         },
            //     ],
            // },
            // {
            //     name: 'register_driver',
            //     description: 'Register or update a driver with Discord ID and Steam ID',
            //     options: [
            //         {
            //             name: 'steam_input',
            //             type: 3, // STRING type
            //             description: 'Steam Profile Link or Vanity Username',
            //             required: true,
            //         },
            //     ],
            // },
            // {
            //     name: 'upload_drivers',
            //     description: 'Upload a CSV file to add multiple drivers to the database',
            //     default_member_permissions: 0, // This permission bit means it's available to everyone by default. Set to 8 for Administrator if you want only admins.
            //     options: [
            //         {
            //             name: 'file',
            //             type: 11, // Attachment type
            //             description: 'Upload a CSV file with driver details',
            //             required: true,
            //         },
            //     ],
            // },
            // {
            //     name: 'list_drivers',
            //     description: 'List all registered drivers in the database',
            // },
            // {
            //     name: 'add_track',
            //     description: 'Add a new track to the database',
            //     default_member_permissions: 0, // Same as above, 0 means everyone, 8 for Administrator
            //     options: [
            //         {
            //             name: 'track_id',
            //             type: 3, // STRING
            //             description: 'Unique track identifier (e.g., red_bull_ring)',
            //             required: true,
            //         },
            //         {
            //             name: 'track_name',
            //             type: 3, // STRING
            //             description: 'Name of the track',
            //             required: true,
            //         },
            //         {
            //             name: 'location',
            //             type: 3, // STRING
            //             description: 'Location of the track',
            //             required: true,
            //         },
            //         {
            //             name: 'track_length',
            //             type: 10, // NUMBER
            //             description: 'Length of the track in kilometers or meters',
            //             required: true,
            //         }
            //     ],
            // }
        ];

        // --- GLOBAL COMMAND DEPLOYMENT (Recommended for production bots) ---
        console.log('🧹 Clearing all GLOBAL commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('✅ Successfully cleared GLOBAL commands.');

        // Add a small delay for Discord API to process clearing
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`🔄 Redeploying ${commands.length} GLOBAL commands...`);
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('✅ GLOBAL commands re-registered successfully.');

        // --- GUILD-SPECIFIC COMMAND DEPLOYMENT (For quicker testing during development) ---
        // This section will only run if DISCORD_GUILD_ID is set in your .env file
        if (guildId) {
            console.log(`\n--- Guild-Specific Deployment for Guild ID: ${guildId} ---`);
            console.log(`🧹 Clearing existing GUILD commands for guild ${guildId}...`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log('✅ Successfully cleared GUILD commands.');

            // Add a small delay for Discord API to process clearing
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log(`🔄 Redeploying ${commands.length} GUILD commands for guild ${guildId}...`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log('✅ GUILD commands re-registered successfully.');
        } else {
            console.log('\nSkipping GUILD command deployment as DISCORD_GUILD_ID is not set in .env.');
        }

    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
        if (error.response) {
            console.error('Discord API Error Response:', error.response.data);
        }
    }
})();