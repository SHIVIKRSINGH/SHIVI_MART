const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/categories
// Get all active categories
router.get('/', async (req, res) => {
    try {
        const [categories] = await db.query(
            'SELECT id, name, slug, image_url, display_order FROM categories WHERE is_active = TRUE ORDER BY display_order'
        );
        
        res.json({ categories });
        
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// GET /api/categories/:slug
// Get single category with product count
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const [categories] = await db.query(`
            SELECT 
                c.id,
                c.name,
                c.slug,
                c.image_url,
                COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_available = TRUE
            WHERE c.slug = ? AND c.is_active = TRUE
            GROUP BY c.id
        `, [slug]);
        
        if (categories.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.json({ category: categories[0] });
        
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

module.exports = router;
