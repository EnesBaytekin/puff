const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve static files from root directory
app.use(express.static(__dirname + '/..'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/puffs', require('./routes/puffs'));

// Initialize database and start server
async function start() {
    try {
        await initDB();
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
