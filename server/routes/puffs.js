const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/puffs/create - Create user's puff
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { name, color } = req.body;
        const userId = req.user.userId;

        if (!name || !color) {
            return res.status(400).json({ error: 'Name and color are required' });
        }

        // Validate color format (hex)
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Invalid color format. Use hex format like #ffd6cc' });
        }

        // Check if user already has a puff
        const existing = await pool.query(
            'SELECT id FROM puffs WHERE user_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Puff already exists' });
        }

        // Create puff
        const result = await pool.query(
            'INSERT INTO puffs (user_id, name, color) VALUES ($1, $2, $3) RETURNING *',
            [userId, name, color]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Create puff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/puffs/mine - Get user's puff
router.get('/mine', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            'SELECT * FROM puffs WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Puff not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get puff error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
