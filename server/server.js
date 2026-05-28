const express = require('express');
const http = require('http');
const cors = require('cors');
const { initDB } = require('./db');
const { setupSocket } = require('./socket');

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

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
setupSocket(server);

// Initialize database and start server
async function start() {
    try {
        await initDB();
        server.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
