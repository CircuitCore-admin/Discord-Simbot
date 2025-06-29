const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const analyzeImage = require('./services/analyzeImage');
const db = require('./services/database');

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
                name: 'over simracers',
                type: ActivityType.Watching,
            }
        ],
    });
    console.log(`🌐 Web server running on http://localhost:${webPort}`);
});

// Message Create Listener for Automatic Image Processing
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

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
                    // Reject invalid laps and stop processing
                    if (!analysisResult.is_valid) {
                        const trackLocationName = analysisResult.track_location_name || 'Unknown Track';
                        const lapTime = analysisResult.lap_time || 'N/A';
                        await message.reply(`❌ Lap Rejected: The fastest lap (${lapTime}) on ${trackLocationName} is invalid due to a penalty. Only valid laps can be processed and recorded.`);
                        return; // Stop processing further for this message
                    }

                    // If the lap is valid, proceed with database insertion and detailed reply
                    const guildId = message.guildId;
                    const channelId = message.channelId;
                    const messageId = message.id;
                    const userId = message.author.id;
                    const discordTag = message.author.tag; // For username#discriminator

                    const driverName = analysisResult.driver_name; // Keep AI-extracted driver name for DB
                    const teamName = analysisResult.team_name;
                    const lapTime = analysisResult.lap_time;
                    const s1Time = analysisResult.s1_time;
                    const s2Time = analysisResult.s2_time;
                    const s3Time = analysisResult.s3_time;
                    const isValid = analysisResult.is_valid;
                    const customSetupBoolean = analysisResult.custom_setup === 'Yes' ? true : false;
                    const trackLocationName = analysisResult.track_location_name;
                    const submissionDate = new Date();

                    let replyContent = `📊 Hotlap Analysis for your image:\n`;
                    replyContent += `Top Lap Time: ${lapTime}\n`;
                    replyContent += `Valid: ${isValid ? '✅' : '❌'}\n`;
                    // --- CHANGED: Use discordTag for display ---
                    replyContent += `Driver: ${discordTag}\n`;
                    // --- END CHANGED ---
                    replyContent += `Team: ${teamName}\n`;
                    replyContent += `Track: ${trackLocationName}\n`;
                    replyContent += `Sectors: S1: ${s1Time}, S2: ${s2Time}, S3: ${s3Time}\n`;
                    replyContent += `Custom Setup: ${customSetupBoolean ? '✅ Yes' : '❌ No'}\n`;
                    replyContent += `Notes: ${isValid ? 'None' : 'Penalty detected on fastest lap'}`;

                    // Insert into the database (driver_name is still included as extracted by AI)
                    await db.query(
                        `INSERT INTO hotlaps (guild_id, channel_id, message_id, user_id, discord_tag, driver_name, team_name, lap_time, s1_time, s2_time, s3_time, is_valid, custom_setup, track_location_name, submission_date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
                        [
                            guildId, channelId, messageId, userId, discordTag,
                            driverName, teamName, lapTime,
                            s1Time, s2Time, s3Time, isValid,
                            customSetupBoolean,
                            trackLocationName, submissionDate
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
const webPort = process.env.WEB_PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper function to convert lap time string (e.g., "1:23.456") to milliseconds
function lapTimeToMs(lapTimeString) {
    if (!lapTimeString || lapTimeString === 'N/A') return null;
    const parts = lapTimeString.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0]);
        const secondsParts = parts[1].split('.');
        const seconds = parseInt(secondsParts[0]);
        const milliseconds = parseInt(secondsParts[1] || '0');
        return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    } else if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const secondsParts = parts[2].split('.');
        const seconds = parseInt(secondsParts[0]);
        const milliseconds = parseInt(secondsParts[1] || '0');
        return (hours * 3600 * 1000) + (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    }
    return null;
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

// API Endpoint to get leaderboard data (fastest lap per driver per track)
app.get('/api/leaderboard', async (req, res) => {
    const trackName = req.query.track;
    const sortColumn = req.query.sortColumn || 'lap_time';
    const sortOrder = req.query.sortOrder || 'asc';
    const excludeInvalid = req.query.excludeInvalid === 'true'; // New parameter

    const allowedSortColumns = new Set([
        'driver_name', 'team_name', 'lap_time', 's1_time', 's2_time',
        's3_time', 'is_valid', 'submission_date', 'track_location_name', 'discord_tag' // Added discord_tag here
    ]);

    if (!allowedSortColumns.has(sortColumn)) {
        return res.status(400).json({ error: 'Invalid sort column.' });
    }

    const orderDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // CTE to select the fastest lap for each unique driver_id and track
    let query = `
        WITH RankedLaps AS (
            SELECT
                id,
                driver_name,
                team_name,
                lap_time,
                s1_time,
                s2_time,
                s3_time,
                is_valid,
                custom_setup,
                track_location_name,
                submission_date,
                user_id,
                discord_tag, -- Include discord_tag here
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, track_location_name
                    ORDER BY
                        CASE
                            WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                            WHEN lap_time ~ '^[0-5]?[0-9]\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                SPLIT_PART(lap_time, '.', 2)::INT
                            ELSE 999999999
                        END ASC,
                        submission_date ASC
                ) as rn
            FROM hotlaps
            WHERE track_location_name ILIKE $1
            ${excludeInvalid ? 'AND is_valid = TRUE' : ''}
        )
        SELECT
            id,
            driver_name,
            team_name,
            lap_time,
            s1_time,
            s2_time,
            s3_time,
            is_valid,
            custom_setup,
            track_location_name,
            submission_date,
            user_id,
            discord_tag -- Select discord_tag here
        FROM RankedLaps
        WHERE rn = 1
    `;
    const params = [trackName]; // trackName is always the first parameter

    // Dynamic ORDER BY clause (applied to the already filtered fastest laps)
    let orderByClause = '';
    switch (sortColumn) {
        case 'lap_time':
        case 's1_time':
        case 's2_time':
        case 's3_time':
            orderByClause = `
                CASE
                    WHEN ${sortColumn} ~ '^[0-9]+:[0-5][0-9]\.[0-9]{3}$' THEN
                        SPLIT_PART(${sortColumn}, ':', 1)::INT * 60000 +
                        SPLIT_PART(SPLIT_PART(${sortColumn}, ':', 2), '.', 1)::INT * 1000 +
                        SPLIT_PART(SPLIT_PART(${sortColumn}, ':', 2), '.', 2)::INT
                    WHEN ${sortColumn} ~ '^[0-5]?[0-9]\.[0-9]{3}$' THEN
                        SPLIT_PART(${sortColumn}, '.', 1)::INT * 1000 +
                        SPLIT_PART(${sortColumn}, '.', 2)::INT
                    ELSE 999999999
                END ${orderDirection} NULLS LAST`;
            break;
        case 'submission_date':
            orderByClause = `${sortColumn} ${orderDirection}`;
            break;
        case 'is_valid':
            orderByClause = `${sortColumn} ${orderDirection}`;
            break;
        case 'custom_setup':
            // Ensure proper boolean casting for sorting if column is text 'Yes'/'No'
            orderByClause = `${sortColumn} ${orderDirection}`;
            break;
        case 'discord_tag': // Added case for sorting by discord_tag
        case 'driver_name': // Keeping this in case it's still needed for other sorts
        case 'team_name':
        case 'track_location_name':
            orderByClause = `${sortColumn} COLLATE "C" ${orderDirection}`;
            break;
        default:
            orderByClause = `${sortColumn} COLLATE "C" ${orderDirection}`;
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

// API Endpoint to get a specific driver's laps for a given track
app.get('/api/driverLaps', async (req, res) => {
    const userId = req.query.userId; // Changed to userId
    const trackName = req.query.track;

    if (!userId || !trackName) {
        return res.status(400).json({ error: 'User ID and track name are required.' });
    }

    try {
        const result = await db.query(
            `SELECT
                id,
                driver_name,
                team_name,
                lap_time,
                s1_time,
                s2_time,
                s3_time,
                is_valid,
                custom_setup,
                track_location_name,
                submission_date,
                user_id,
                discord_tag -- Include discord_tag here
            FROM hotlaps
            WHERE user_id = $1 AND track_location_name ILIKE $2
            ORDER BY
                CASE
                    WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\.[0-9]{3}$' THEN
                        SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                        SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                        SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                    WHEN lap_time ~ '^[0-5]?[0-9]\.[0-9]{3}$' THEN
                        SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                        SPLIT_PART(lap_time, '.', 2)::INT
                    ELSE 999999999
                END ASC;`,
            [userId, trackName]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching driver laps:', err);
        res.status(500).json({ error: 'Failed to fetch driver laps.' });
    }
});

// --- Static File Serving for React Frontend ---
const reactAppBuildPath = path.join(__dirname, 'leaderboard-frontend', 'dist');

app.use(express.static(reactAppBuildPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(reactAppBuildPath, 'index.html'));
});

// Start the Express server
app.listen(webPort, () => {
    // console.log(`🌐 Web server running on http://localhost:${webPort}`);
});