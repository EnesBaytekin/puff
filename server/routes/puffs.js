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

// PUT /api/puffs/state - Update puff state (for testing)
router.put('/state', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { hunger, mood, energy } = req.body;

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (hunger !== undefined) {
            if (hunger < 0 || hunger > 100) {
                return res.status(400).json({ error: 'Hunger must be between 0 and 100' });
            }
            updates.push(`hunger = $${paramCount++}`);
            values.push(hunger);
        }

        if (mood !== undefined) {
            if (mood < 0 || mood > 100) {
                return res.status(400).json({ error: 'Mood must be between 0 and 100' });
            }
            updates.push(`mood = $${paramCount++}`);
            values.push(mood);
        }

        if (energy !== undefined) {
            if (energy < 0 || energy > 100) {
                return res.status(400).json({ error: 'Energy must be between 0 and 100' });
            }
            updates.push(`energy = $${paramCount++}`);
            values.push(energy);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Add updated_at timestamp
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const query = `
            UPDATE puffs
            SET ${updates.join(', ')}
            WHERE user_id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Puff not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update puff state error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
