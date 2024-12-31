Lets make a discord.js slash command, lets make a leaderboard per track (with autofill in the command, by pulling the track_name from the track_info table in the database). Please also get the lap times from driver_track_info then get the fastest laps (either from fastest_q_lap or fastest_r_lap, which ever one is faster)
Then display 10 at a time, and whoever set that time (look that up with the steam_id corresponding with that lap time, and find the real_name in the driver_info table with that steam_id)


here is my current deploy-commands.js:
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


and here is my interactionCreate.js:
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            // Handle Slash Commands
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                console.log(🚀 Executing command: ${interaction.commandName});
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
                console.log(🔄 Handling autocomplete for: ${interaction.commandName});
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                } else {
                    console.warn(⚠️ No autocomplete handler defined for: ${interaction.commandName});
                }
            } catch (error) {
                console.error('❌ Error handling autocomplete:', error);
                await interaction.respond([]);
            }
        }
    },
};

and here is my index.js:
const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,  // Required for commands and message content
        GatewayIntentBits.GuildMembers,    // Required for member information
        GatewayIntentBits.GuildPresences,  // Optional, if presence information is needed
    ],
});

// Load commands dynamically
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(./commands/${file});
    client.commands.set(command.data.name, command);
}

// Event Handlers
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(./events/${file});
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Bot is Ready
client.once('ready', () => {
    console.log(✅ Logged in as ${client.user.tag});

    // Set Bot Presence
    client.user.setPresence({
        status: 'online', // online, idle, dnd, invisible
        activities: [
            {
                name: 'over WGC', // Activity name
                type: ActivityType.Watching, // Playing, Streaming, Listening, Watching, Competing
            }
        ],
    });
});

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);

this is my database.js code:
// services/database.js
const { Pool } = require('pg');
require('dotenv').config();

// Create a PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test the connection
pool.connect()
    .then(() => console.log('✅ Connected to the PostgreSQL database!'))
    .catch(err => console.error('❌ Error connecting to the database:', err));

// Export query method for easy usage
module.exports = {
    query: (text, params) => pool.query(text, params),
};



If the driver that requested the command has registered, display their own laptime as the 11th entry on the leaderboard message, however I want to have their position on the leaderboard displayed there.


So for example

1. Alex 1:50.222
2. Xela 1:51.212
3. Wil 1:52.124
4. Jak 1:52.524
5. James 1:53.683
6. Jimmy 1:53.974
7. Stephan 1:54.232
8. Guru 1:55.838
9. Mat 1:56.318
10. Ron 1:58.383
**23. MYSELF 2:01.384