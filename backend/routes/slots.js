const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/slots
// Get all active delivery slots
router.get('/', async (req, res) => {
    try {
        const [slots] = await db.query(`
            SELECT 
                id,
                slot_start,
                slot_end,
                max_orders,
                is_active
            FROM delivery_slots
            WHERE is_active = TRUE
            ORDER BY slot_start
        `);
        
        res.json({ slots });
        
    } catch (error) {
        console.error('Get slots error:', error);
        res.status(500).json({ error: 'Failed to fetch delivery slots' });
    }
});

// GET /api/slots/available
// Get available slots for a specific date
router.get('/available', async (req, res) => {
    try {
        const { date } = req.query; // Format: YYYY-MM-DD
        
        if (!date) {
            return res.status(400).json({ error: 'Date parameter required' });
        }
        
        const [slots] = await db.query(`
            SELECT 
                ds.id,
                ds.slot_start,
                ds.slot_end,
                ds.max_orders,
                COUNT(o.id) as booked_orders,
                (ds.max_orders - COUNT(o.id)) as available_slots
            FROM delivery_slots ds
            LEFT JOIN orders o ON ds.id = o.delivery_slot_id 
                AND o.delivery_date = ? 
                AND o.order_status NOT IN ('cancelled')
            WHERE ds.is_active = TRUE
            GROUP BY ds.id
            HAVING available_slots > 0
            ORDER BY ds.slot_start
        `, [date]);
        
        res.json({ slots, date });
        
    } catch (error) {
        console.error('Get available slots error:', error);
        res.status(500).json({ error: 'Failed to fetch available slots' });
    }
});

module.exports = router;
