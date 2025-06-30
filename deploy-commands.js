const { REST, Routes, PermissionFlagsBits } = require('discord.js');
require('dotenv').config(); // Make sure this is at the very top to load environment variables first
const fs = require('fs');

// --- Environment Variable Checks ---
const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID; // Ensure this matches your .env variable name
const guildId = process.env.DISCORD_GUILD_ID; // Uncomment and set in .env for guild-specific testing

if (!discordToken) {
    console.error('❌ DISCORD_TOKEN not found in .env file. Please ensure it is set.');
    process.exit(1); // Exit if critical env var is missing
}
if (!clientId) {
    console.error('❌ DISCORD_CLIENT_ID not found in .env file. Global commands cannot be deployed without it.');
    process.exit(1); // Exit if critical env var is missing
}
// if (!guildId) {
//     console.warn('⚠️ DISCORD_GUILD_ID not found in .env file. Guild-specific commands cannot be deployed. Deploying globally.');
//     // Don't exit, as global deployment might still be desired
// }


const rest = new REST({ version: '10' }).setToken(discordToken);

(async () => {
    try {
        const commands = [
            {
                name: 'analyze_hotlap',
                description: 'Analyze an F1 hotlap screenshot using OCR and GPT-4',
                options: [
                    {
                        name: 'image',
                        type: 11, // Attachment
                        description: 'Upload the screenshot of the hotlap',
                        required: true,
                    },
                ],
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
                // Restore default_member_permissions to require Manage Channels permission
                default_member_permissions: PermissionFlagsBits.ManageChannels.toString(),
                setDMPermission: false, // Command cannot be used in DMs
            },
            {
                name: 'f1-leaderboard',
                description: 'Displays the F1 hotlap leaderboard for a selected track.',
                options: [
                    {
                        name: 'track',
                        type: 3, // STRING type
                        description: 'Select a track to view the leaderboard.',
                        required: true,
                        autocomplete: true, // This enables dynamic suggestions for tracks
                    },
                    {
                        name: 'custom_setup_only',
                        type: 5, // BOOLEAN type
                        description: 'Show only laps with custom setup (True/False).',
                        required: false, // Optional filter
                    }
                ],
            },
            // The following commands were present in your previous deploy-commands.js.
            // I'm keeping them commented out for brevity, but you should uncomment
            // and include them if they are part of your bot's functionality.
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

        console.log(`🔄 Redeploying ${commands.length} GLOBAL commands...`);
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('✅ GLOBAL commands re-registered successfully.');

        // --- GUILD-SPECIFIC COMMAND DEPLOYMENT (For quicker testing) ---
        // Uncomment the lines below AND uncomment 'const guildId = process.env.DISCORD_GUILD_ID;' above
        // and set DISCORD_GUILD_ID in your .env file to your test server's ID.
        // This will deploy commands only to that specific guild, making them appear almost instantly.
        // Remember to comment this back out and use global deployment for your final bot.

        if (guildId) {
            console.log(`🧹 Clearing all GUILD commands for guild ${guildId}...`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log('✅ Successfully cleared GUILD commands.');

            console.log(`🔄 Redeploying ${commands.length} GUILD commands for guild ${guildId}...`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log('✅ GUILD commands re-registered successfully.');
        } else {
            console.log('Skipping GUILD command deployment as DISCORD_GUILD_ID is not set.');
        }

    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
    }
})();
