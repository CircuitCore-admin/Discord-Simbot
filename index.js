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
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Event Handlers
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Bot is Ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

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
