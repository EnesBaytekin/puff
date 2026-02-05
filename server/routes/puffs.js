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

// GET /api/puffs/mine - Get user's puff with offline decay calculation
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

        let puff = result.rows[0];

        // Calculate offline decay
        const now = new Date();
        const lastUpdate = new Date(puff.updated_at);
        const minutesPassed = (now - lastUpdate) / (1000 * 60);

        if (minutesPassed > 0) {
            // Decay rates (per minute) - 10 hours = 600 minutes for 100→1
            // Fullness: ~10 hours to reach minimum
            // Mood: ~8 hours to reach minimum
            // Energy: ~6.5 hours to reach minimum
            const FULLNESS_DECAY_PER_MIN = 99 / 600;  // ~0.165
            const MOOD_DECAY_PER_MIN = 99 / 480;      // ~0.206
            const ENERGY_DECAY_PER_MIN = 99 / 390;    // ~0.254

            // Calculate decayed values (minimum = 1)
            let newHunger = Math.max(1, Math.round(puff.hunger - (minutesPassed * FULLNESS_DECAY_PER_MIN)));
            let newMood = Math.max(1, Math.round(puff.mood - (minutesPassed * MOOD_DECAY_PER_MIN)));
            let newEnergy = Math.max(1, Math.round(puff.energy - (minutesPassed * ENERGY_DECAY_PER_MIN)));

            // Only update if values actually changed
            if (newHunger !== puff.hunger || newMood !== puff.mood || newEnergy !== puff.energy) {
                // Update database with decayed values
                const updateResult = await pool.query(
                    `UPDATE puffs
                     SET hunger = $1, mood = $2, energy = $3, updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $4
                     RETURNING *`,
                    [newHunger, newMood, newEnergy, userId]
                );
                puff = updateResult.rows[0];
            }
        }

        res.json(puff);
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
            if (hunger < 1 || hunger > 100) {
                return res.status(400).json({ error: 'Hunger must be between 1 and 100' });
            }
            updates.push(`hunger = $${paramCount++}`);
            values.push(hunger);
        }

        if (mood !== undefined) {
            if (mood < 1 || mood > 100) {
                return res.status(400).json({ error: 'Mood must be between 1 and 100' });
            }
            updates.push(`mood = $${paramCount++}`);
            values.push(mood);
        }

        if (energy !== undefined) {
            if (energy < 1 || energy > 100) {
                return res.status(400).json({ error: 'Energy must be between 1 and 100' });
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
