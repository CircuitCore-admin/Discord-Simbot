const { Pool } = require('pg');

// PostgreSQL Connection Pool
const pool = new Pool({
    user: 'postgres',          // Replace with your DB username
    host: 'localhost',         // Replace with your DB host
    database: 'discord_bot_stats',
    password: 'PASSWORD HERE', // Replace with your DB password
    port: 5432,                // Default PostgreSQL port
});

// Test Connection
pool.connect()
    .then(() => console.log('✅ Connected to PostgreSQL Database'))
    .catch(err => console.error('❌ Connection Error:', err));

module.exports = pool;
