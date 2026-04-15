const express = require('express');
const router = express.Router();
const db = require('../config/database');

// POST /api/cart/validate
// Validate cart items (check stock, prices, availability)
router.post('/validate', async (req, res) => {
    try {
        const { items } = req.body; // Array of { product_id, quantity }
        
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        const productIds = items.map(item => item.product_id);
        
        const [products] = await db.query(`
            SELECT 
                id,
                name,
                price,
                unit,
                discount_percentage,
                stock_quantity,
                is_available,
                ROUND(price - (price * discount_percentage / 100), 2) as discounted_price
            FROM products
            WHERE id IN (?)
        `, [productIds]);
        
        const validated = items.map(cartItem => {
            const product = products.find(p => p.id === cartItem.product_id);
            
            if (!product) {
                return {
                    ...cartItem,
                    error: 'Product not found',
                    is_valid: false
                };
            }
            
            if (!product.is_available) {
                return {
                    ...cartItem,
                    product,
                    error: 'Product not available',
                    is_valid: false
                };
            }
            
            if (product.stock_quantity < cartItem.quantity) {
                return {
                    ...cartItem,
                    product,
                    error: `Only ${product.stock_quantity} ${product.unit} available`,
                    is_valid: false
                };
            }
            
            return {
                ...cartItem,
                product,
                item_total: product.discounted_price * cartItem.quantity,
                is_valid: true
            };
        });
        
        const isValid = validated.every(item => item.is_valid);
        const subtotal = validated
            .filter(item => item.is_valid)
            .reduce((sum, item) => sum + item.item_total, 0);
        
        res.json({
            is_valid: isValid,
            items: validated,
            subtotal: Math.round(subtotal * 100) / 100,
            total_items: validated.filter(item => item.is_valid).length
        });
        
    } catch (error) {
        console.error('Cart validation error:', error);
        res.status(500).json({ error: 'Failed to validate cart' });
    }
});

module.exports = router;
