const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'puff',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20
});

// Initialize database tables
async function initDB() {
    const client = await pool.connect();

    try {
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(20) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Users table initialized (username-based)');

        // Create puffs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS puffs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(7) NOT NULL,
                hunger INTEGER DEFAULT 50 CHECK (hunger >= 0 AND hunger <= 100),
                mood INTEGER DEFAULT 50 CHECK (mood >= 0 AND mood <= 100),
                energy INTEGER DEFAULT 50 CHECK (energy >= 0 AND energy <= 100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Puffs table initialized');

        // Migration: Add is_sleeping column if not exists (for existing databases)
        try {
            // Check if column exists
            const columnCheck = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'puffs' AND column_name = 'is_sleeping'
            `);

            if (columnCheck.rows.length === 0) {
                // Column doesn't exist, add it
                await client.query(`
                    ALTER TABLE puffs
                    ADD COLUMN is_sleeping BOOLEAN DEFAULT FALSE
                `);
                console.log('Migration: Added is_sleeping column to puffs table');
            } else {
                console.log('Migration: is_sleeping column already exists');
            }
        } catch (err) {
            console.error('Migration error (is_sleeping):', err.message);
            // Don't throw - migration errors shouldn't crash the app
        }

    } catch (err) {
        console.error('Database initialization error:', err);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, initDB };
