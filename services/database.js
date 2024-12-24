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
