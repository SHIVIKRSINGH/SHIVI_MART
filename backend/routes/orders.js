const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('./auth');

// Helper function to generate order number
function generateOrderNumber() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
}

// POST /api/orders
// Create new order
router.post('/', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { 
            address_id, 
            delivery_slot_id, 
            delivery_date, 
            items, // [{ product_id, quantity }]
            payment_method = 'cash',
            delivery_notes 
        } = req.body;
        
        // Validation
        if (!address_id || !delivery_slot_id || !delivery_date || !items || items.length === 0) {
            throw new Error('Missing required fields');
        }
        
        // Verify address belongs to user
        const [addresses] = await connection.query(
            'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
            [address_id, req.userId]
        );
        
        if (addresses.length === 0) {
            throw new Error('Invalid address');
        }
        
        // Get product details
        const productIds = items.map(item => item.product_id);
        const [products] = await connection.query(`
            SELECT 
                id, name, price, discount_percentage, stock_quantity, is_available,
                ROUND(price - (price * discount_percentage / 100), 2) as discounted_price
            FROM products
            WHERE id IN (?) AND is_available = TRUE
        `, [productIds]);
        
        if (products.length !== items.length) {
            throw new Error('Some products are not available');
        }
        
        // Calculate totals
        let subtotal = 0;
        let totalDiscount = 0;
        const orderItems = items.map(cartItem => {
            const product = products.find(p => p.id === cartItem.product_id);
            
            if (!product) {
                throw new Error(`Product ${cartItem.product_id} not found`);
            }
            
            if (product.stock_quantity < cartItem.quantity) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }
            
            const itemPrice = product.price * cartItem.quantity;
            const itemDiscount = itemPrice * (product.discount_percentage / 100);
            const itemTotal = itemPrice - itemDiscount;
            
            subtotal += itemPrice;
            totalDiscount += itemDiscount;
            
            return {
                product_id: product.id,
                product_name: product.name,
                quantity: cartItem.quantity,
                unit_price: product.price,
                discount_percentage: product.discount_percentage,
                total_price: Math.round(itemTotal * 100) / 100
            };
        });
        
        const totalAmount = Math.round((subtotal - totalDiscount) * 100) / 100;
        const orderNumber = generateOrderNumber();
        
        // Create order
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_number, user_id, address_id, delivery_slot_id, delivery_date,
                subtotal, discount_amount, total_amount, payment_method, delivery_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            orderNumber, req.userId, address_id, delivery_slot_id, delivery_date,
            Math.round(subtotal * 100) / 100, Math.round(totalDiscount * 100) / 100, 
            totalAmount, payment_method, delivery_notes
        ]);
        
        const orderId = orderResult.insertId;
        
        // Insert order items
        for (const item of orderItems) {
            await connection.query(`
                INSERT INTO order_items (
                    order_id, product_id, product_name, quantity, 
                    unit_price, discount_percentage, total_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, item.product_id, item.product_name, item.quantity,
                item.unit_price, item.discount_percentage, item.total_price
            ]);
            
            // Update stock
            await connection.query(
                'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }
        
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Order placed successfully',
            order: {
                id: orderId,
                order_number: orderNumber,
                total_amount: totalAmount
            }
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Create order error:', error);
        res.status(400).json({ error: error.message || 'Failed to create order' });
    } finally {
        connection.release();
    }
});

// GET /api/orders
// Get user's orders
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.payment_method,
                o.payment_status,
                o.order_status,
                o.delivery_date,
                o.created_at,
                ds.slot_start,
                ds.slot_end,
                s.name as society_name,
                a.tower_no,
                a.flat_no
            FROM orders o
            JOIN delivery_slots ds ON o.delivery_slot_id = ds.id
            JOIN addresses a ON o.address_id = a.id
            JOIN societies s ON a.society_id = s.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        `, [req.userId]);
        
        res.json({ orders });
        
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// GET /api/orders/:id
// Get order details
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get order details
        const [orders] = await db.query(`
            SELECT 
                o.*,
                ds.slot_start,
                ds.slot_end,
                s.name as society_name,
                s.area,
                a.tower_no,
                a.flat_no,
                a.landmark
            FROM orders o
            JOIN delivery_slots ds ON o.delivery_slot_id = ds.id
            JOIN addresses a ON o.address_id = a.id
            JOIN societies s ON a.society_id = s.id
            WHERE o.id = ? AND o.user_id = ?
        `, [id, req.userId]);
        
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Get order items
        const [items] = await db.query(`
            SELECT 
                oi.*,
                p.image_url,
                p.unit
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [id]);
        
        res.json({ 
            order: orders[0],
            items 
        });
        
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

// PUT /api/orders/:id/cancel
// Cancel order (only if pending)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { id } = req.params;
        
        // Get order
        const [orders] = await connection.query(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [id, req.userId]
        );
        
        if (orders.length === 0) {
            throw new Error('Order not found');
        }
        
        const order = orders[0];
        
        if (order.order_status !== 'pending') {
            throw new Error('Only pending orders can be cancelled');
        }
        
        // Update order status
        await connection.query(
            'UPDATE orders SET order_status = ? WHERE id = ?',
            ['cancelled', id]
        );
        
        // Restore stock
        const [items] = await connection.query(
            'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
            [id]
        );
        
        for (const item of items) {
            await connection.query(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }
        
        await connection.commit();
        
        res.json({ success: true, message: 'Order cancelled successfully' });
        
    } catch (error) {
        await connection.rollback();
        console.error('Cancel order error:', error);
        res.status(400).json({ error: error.message || 'Failed to cancel order' });
    } finally {
        connection.release();
    }
});

module.exports = router;
