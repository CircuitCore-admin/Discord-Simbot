const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const express = require('express');
const cors = require('cors'); // This line is correct and crucial!

const analyzeImage = require('./services/analyzeImage');
const db = require('./services/database'); // Import database service

// --- Discord Bot Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

// Load commands dynamically
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// Load event handlers dynamically
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Bot is Ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setPresence({
        status: 'online',
        activities: [
            {
                name: 'over WGC',
                type: ActivityType.Watching,
            }
        ],
    });
    // Ensure webPort is defined before this console.log if it's placed here
    console.log(`🌐 Web server running on http://localhost:${webPort}`);
});

// Message Create Listener for Automatic Image Processing
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return; // Ensure it's in a guild, not a DM

    let configuredChannelId = null;
    try {
        const res = await db.query('SELECT hotlap_channel_id FROM guild_settings WHERE guild_id = $1;', [message.guildId]);
        if (res.rows.length > 0) {
            configuredChannelId = res.rows[0].hotlap_channel_id;
        }
    } catch (error) {
        console.error(`❌ Database error fetching guild settings for ${message.guildId}:`, error);
        return;
    }

    if (!configuredChannelId || message.channel.id !== configuredChannelId.toString()) {
        return;
    }

    if (message.attachments.size > 0) {
        let imageAttachment = null;
        for (const [key, attachment] of message.attachments) {
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                imageAttachment = attachment;
                break;
            }
        }

        if (imageAttachment) {
            try {
                await message.channel.sendTyping();
                const analysisResult = await analyzeImage(imageAttachment.url);

                if (analysisResult.status === 'incomplete') {
                    await message.reply(`⚠️ ${analysisResult.message}. Please upload a full screenshot showing ALL required sections and columns (Track Location, Driver, Team, Time, S1, S2, S3, PEN., Custom Setup, Assists).`);
                } else if (analysisResult.status === 'complete') {
                    const guildId = message.guildId;
                    const channelId = message.channelId;
                    const messageId = message.id;
                    const userId = message.author.id;
                    const driverName = analysisResult.driver_name;
                    const teamName = analysisResult.team_name;
                    const lapTime = analysisResult.lap_time;
                    const s1Time = analysisResult.s1_time;
                    const s2Time = analysisResult.s2_time;
                    const s3Time = analysisResult.s3_time;
                    const isValid = analysisResult.is_valid;
                    const customSetup = analysisResult.custom_setup;
                    const trackLocationName = analysisResult.track_location_name;
                    const submissionDate = new Date();

                    let replyContent = `📊 Hotlap Analysis for your image:\n`;
                    replyContent += `Top Lap Time: ${lapTime}\n`;
                    replyContent += `Valid: ${isValid ? '✅' : '❌'}\n`;
                    replyContent += `Driver: ${driverName}\n`;
                    replyContent += `Team: ${teamName}\n`;
                    replyContent += `Track: ${trackLocationName}\n`;
                    replyContent += `Sectors: S1: ${s1Time}, S2: ${s2Time}, S3: ${s3Time}\n`;
                    replyContent += `Custom Setup: ${customSetup}\n`;
                    replyContent += `Notes: ${isValid ? 'None' : 'Penalty detected on fastest lap'}`;

                    await db.query(
                        `INSERT INTO hotlaps (guild_id, channel_id, message_id, user_id, driver_name, team_name, lap_time, s1_time, s2_time, s3_time, is_valid, custom_setup, track_location_name, submission_date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
                        [
                            guildId, channelId, messageId, userId,
                            driverName, teamName, lapTime,
                            s1Time, s2Time, s3Time, isValid,
                            customSetup, trackLocationName, submissionDate
                        ]
                    );

                    await message.reply({
                        content: `\`\`\`\n${replyContent}\n\`\`\`\nYour hotlap has been recorded!`
                    });
                } else {
                    console.error('❌ Unexpected analysis status from Gemini:', analysisResult.status);
                    await message.reply('⚠️ Something went wrong during analysis. Unexpected AI response.');
                }

            } catch (error) {
                console.error('❌ Error processing image from message:', error);
                await message.reply(`⚠️ Sorry, I couldn't analyze that image. ${error.message || 'An unknown error occurred.'}`);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);


// --- Web Server Setup ---
const app = express();
const webPort = process.env.WEB_PORT || 3000; // Use port from .env or default to 3000

app.use(cors()); // Enable CORS for all routes (important for frontend to fetch data)
app.use(express.json()); // Enable JSON body parsing

// Helper function to convert lap time string (e.g., "1:23.456") to milliseconds
function lapTimeToMs(lapTimeString) {
    if (!lapTimeString || lapTimeString === 'N/A') return null;
    const parts = lapTimeString.split(':');
    if (parts.length === 2) { // M:SS.mmm
        const minutes = parseInt(parts[0]);
        const secondsParts = parts[1].split('.');
        const seconds = parseInt(secondsParts[0]);
        const milliseconds = parseInt(secondsParts[1] || '0');
        return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    } else if (parts.length === 3) { // H:MM:SS.mmm (less common for F1 hotlaps, but good to handle)
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const secondsParts = parts[2].split('.');
        const seconds = parseInt(secondsParts[0]);
        const milliseconds = parseInt(secondsParts[1] || '0');
        return (hours * 3600 * 1000) + (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    }
    return null; // Invalid format
}

// API Endpoint to get unique track locations
app.get('/api/tracks', async (req, res) => {
    try {
        const result = await db.query('SELECT DISTINCT track_location_name FROM hotlaps ORDER BY track_location_name;');
        res.json(result.rows.map(row => row.track_location_name));
    } catch (err) {
        console.error('❌ Error fetching tracks:', err);
        res.status(500).json({ error: 'Failed to fetch track list.' });
    }
});

// API Endpoint to get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
    const trackName = req.query.track;
    const sortColumn = req.query.sortColumn || 'lap_time'; // Default to lap_time
    const sortOrder = req.query.sortOrder || 'asc';      // Default to ascending

    // Whitelist allowed sort columns to prevent SQL injection
    const allowedSortColumns = new Set([
        'driver_name', 'team_name', 'lap_time', 's1_time', 's2_time',
        's3_time', 'is_valid', 'submission_date', 'track_location_name'
    ]);

    if (!allowedSortColumns.has(sortColumn)) {
        return res.status(400).json({ error: 'Invalid sort column.' });
    }

    const orderDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let query = `
        SELECT
            driver_name,
            team_name,
            lap_time,
            s1_time,
            s2_time,
            s3_time,
            is_valid,
            custom_setup,
            track_location_name,
            submission_date
        FROM hotlaps
    `;
    const params = [];
    let paramIndex = 1;

    if (trackName) {
        query += ` WHERE track_location_name ILIKE $${paramIndex}`;
        params.push(trackName);
        paramIndex++;
    }

    // Dynamic ORDER BY clause with type conversion for time fields
    let orderByClause = '';
    switch (sortColumn) {
        case 'lap_time':
        case 's1_time':
        case 's2_time':
        case 's3_time':
            // Convert 'M:SS.mmm' or 'SS.mmm' text to milliseconds for numerical sorting
            // Note: This assumes times are always in 'M:SS.mmm' or 'SS.mmm' format.
            // If they can be 'N/A', NULLs will be handled by the CASE WHEN NULL clause.
            orderByClause = `
                CASE
                    WHEN ${sortColumn} ~ '^[0-9]+:[0-5][0-9]\.[0-9]{3}$' THEN -- M:SS.mmm
                        SPLIT_PART(${sortColumn}, ':', 1)::INT * 60000 +
                        SPLIT_PART(SPLIT_PART(${sortColumn}, ':', 2), '.', 1)::INT * 1000 +
                        SPLIT_PART(SPLIT_PART(${sortColumn}, ':', 2), '.', 2)::INT
                    WHEN ${sortColumn} ~ '^[0-5]?[0-9]\.[0-9]{3}$' THEN -- SS.mmm (optional M if single digit)
                        SPLIT_PART(${sortColumn}, '.', 1)::INT * 1000 +
                        SPLIT_PART(${sortColumn}, '.', 2)::INT
                    ELSE NULL -- Handles 'N/A' or other non-numeric strings by putting them last/first
                END ${orderDirection} NULLS LAST`;
            break;
        case 'submission_date':
            orderByClause = `${sortColumn} ${orderDirection}`; // timestamp sorts directly
            break;
        case 'is_valid':
            orderByClause = `${sortColumn} ${orderDirection}`; // boolean sorts directly
            break;
        case 'custom_setup':
            // Convert text 'true'/'false' to boolean for proper sorting
            orderByClause = `(${sortColumn}::boolean) ${orderDirection}`;
            break;
        default:
            // For text fields like driver_name, team_name, track_location_name
            orderByClause = `${sortColumn} COLLATE "C" ${orderDirection}`; // Use COLLATE "C" for consistent string sorting
            break;
    }

    query += ` ORDER BY ${orderByClause};`;

    try {
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching leaderboard data:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard data.' });
    }
});

// --- Static File Serving for React Frontend ---
// Assuming 'leaderboard-frontend' is a sub-directory of 'Discord-Simbot'
const reactAppBuildPath = path.join(__dirname, 'leaderboard-frontend', 'dist');

// Serve static files from the React app's build directory
// This middleware will try to match requests like '/', '/static/css/main.css', etc.
// It should be placed AFTER your specific API routes.
app.use(express.static(reactAppBuildPath));

// For any other GET request that was not handled by API routes or static files,
// serve the React app's index.html. This is crucial for client-side routing.
// This route MUST be the very last route defined in your Express app.
app.get('*', (req, res) => {
    res.sendFile(path.join(reactAppBuildPath, 'index.html'));
});


// Start the Express server
app.listen(webPort, () => {
    // console.log(`🌐 Web server running on http://localhost:${webPort}`); // This is logged in client.once('ready')
});

// Add WEB_PORT to your .env file
// WEB_PORT=3000