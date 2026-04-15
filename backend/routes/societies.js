const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('./auth');

// GET /api/societies
// Get all active societies
router.get('/', async (req, res) => {
    try {
        const [societies] = await db.query(
            'SELECT id, name, area, pincode FROM societies WHERE is_active = TRUE ORDER BY name'
        );
        
        res.json({ societies });
        
    } catch (error) {
        console.error('Get societies error:', error);
        res.status(500).json({ error: 'Failed to fetch societies' });
    }
});

// POST /api/societies/address
// Add new address for user
router.post('/address', authMiddleware, async (req, res) => {
    try {
        const { society_id, tower_no, flat_no, landmark, is_default } = req.body;
        
        if (!society_id || !flat_no) {
            return res.status(400).json({ error: 'Society and flat number required' });
        }
        
        // If this is default, unset other defaults
        if (is_default) {
            await db.query(
                'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
                [req.userId]
            );
        }
        
        const [result] = await db.query(
            'INSERT INTO addresses (user_id, society_id, tower_no, flat_no, landmark, is_default) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, society_id, tower_no, flat_no, landmark, is_default || false]
        );
        
        res.json({ 
            success: true, 
            message: 'Address added successfully',
            address_id: result.insertId
        });
        
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to add address' });
    }
});

// GET /api/societies/my-addresses
// Get user's addresses
router.get('/my-addresses', authMiddleware, async (req, res) => {
    try {
        const [addresses] = await db.query(`
            SELECT 
                a.id,
                a.tower_no,
                a.flat_no,
                a.landmark,
                a.is_default,
                s.name as society_name,
                s.area,
                s.pincode
            FROM addresses a
            JOIN societies s ON a.society_id = s.id
            WHERE a.user_id = ?
            ORDER BY a.is_default DESC, a.created_at DESC
        `, [req.userId]);
        
        res.json({ addresses });
        
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

// PUT /api/societies/address/:id
// Update address
router.put('/address/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { society_id, tower_no, flat_no, landmark, is_default } = req.body;
        
        // If this is default, unset other defaults
        if (is_default) {
            await db.query(
                'UPDATE addresses SET is_default = FALSE WHERE user_id = ? AND id != ?',
                [req.userId, id]
            );
        }
        
        await db.query(
            'UPDATE addresses SET society_id = ?, tower_no = ?, flat_no = ?, landmark = ?, is_default = ? WHERE id = ? AND user_id = ?',
            [society_id, tower_no, flat_no, landmark, is_default, id, req.userId]
        );
        
        res.json({ success: true, message: 'Address updated successfully' });
        
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address' });
    }
});

// DELETE /api/societies/address/:id
// Delete address
router.delete('/address/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query(
            'DELETE FROM addresses WHERE id = ? AND user_id = ?',
            [id, req.userId]
        );
        
        res.json({ success: true, message: 'Address deleted successfully' });
        
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address' });
    }
});

module.exports = router;
