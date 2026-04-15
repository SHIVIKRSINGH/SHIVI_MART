const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/products
// Get all products with optional filters
router.get('/', async (req, res) => {
    try {
        const { category, search, featured } = req.query;
        
        let query = `
            SELECT 
                p.id,
                p.name,
                p.slug,
                p.description,
                p.image_url,
                p.price,
                p.unit,
                p.discount_percentage,
                p.stock_quantity,
                p.is_available,
                p.is_featured,
                c.name as category_name,
                c.slug as category_slug,
                ROUND(p.price - (p.price * p.discount_percentage / 100), 2) as discounted_price
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_available = TRUE
        `;
        
        const params = [];
        
        if (category) {
            query += ' AND c.slug = ?';
            params.push(category);
        }
        
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (featured === 'true') {
            query += ' AND p.is_featured = TRUE';
        }
        
        query += ' ORDER BY p.is_featured DESC, p.name';
        
        const [products] = await db.query(query, params);
        
        res.json({ products });
        
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET /api/products/category/:slug
// Get products by category slug
router.get('/category/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const [products] = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.slug,
                p.description,
                p.image_url,
                p.price,
                p.unit,
                p.discount_percentage,
                p.stock_quantity,
                p.is_available,
                p.is_featured,
                c.name as category_name,
                c.slug as category_slug,
                ROUND(p.price - (p.price * p.discount_percentage / 100), 2) as discounted_price
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE c.slug = ? AND p.is_available = TRUE
            ORDER BY p.is_featured DESC, p.name
        `, [slug]);
        
        res.json({ products });
        
    } catch (error) {
        console.error('Get category products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET /api/products/:slug
// Get single product by slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const [products] = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.slug,
                p.description,
                p.image_url,
                p.price,
                p.unit,
                p.discount_percentage,
                p.stock_quantity,
                p.is_available,
                p.is_featured,
                c.id as category_id,
                c.name as category_name,
                c.slug as category_slug,
                ROUND(p.price - (p.price * p.discount_percentage / 100), 2) as discounted_price
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.slug = ?
        `, [slug]);
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({ product: products[0] });
        
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// GET /api/products/featured/list
// Get featured products
router.get('/featured/list', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.slug,
                p.description,
                p.image_url,
                p.price,
                p.unit,
                p.discount_percentage,
                p.stock_quantity,
                c.name as category_name,
                c.slug as category_slug,
                ROUND(p.price - (p.price * p.discount_percentage / 100), 2) as discounted_price
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_featured = TRUE AND p.is_available = TRUE
            ORDER BY p.name
            LIMIT 10
        `);
        
        res.json({ products });
        
    } catch (error) {
        console.error('Get featured products error:', error);
        res.status(500).json({ error: 'Failed to fetch featured products' });
    }
});

module.exports = router;
