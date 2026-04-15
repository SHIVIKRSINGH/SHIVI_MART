const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');

// Simple admin authentication (in production, use proper admin auth)
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// ============================================
// PRODUCTS MANAGEMENT
// ============================================

// GET /api/admin/products
// Get all products (including inactive)
router.get('/products', adminAuth, async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT 
                p.*,
                c.name as category_name
            FROM products p
            JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC
        `);
        
        res.json({ products });
        
    } catch (error) {
        console.error('Admin get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// POST /api/admin/products
// Create new product
router.post('/products', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { 
            category_id, name, description, price, unit, 
            discount_percentage, stock_quantity, is_featured 
        } = req.body;
        
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;
        
        const [result] = await db.query(`
            INSERT INTO products (
                category_id, name, slug, description, image_url, price, unit,
                discount_percentage, stock_quantity, is_featured
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            category_id, name, slug, description, image_url, price, unit,
            discount_percentage || 0, stock_quantity || 0, is_featured || false
        ]);
        
        res.json({ 
            success: true, 
            message: 'Product created successfully',
            product_id: result.insertId
        });
        
    } catch (error) {
        console.error('Admin create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PUT /api/admin/products/:id
// Update product
router.put('/products/:id', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            category_id, name, description, price, unit,
            discount_percentage, stock_quantity, is_available, is_featured 
        } = req.body;
        
        let updateQuery = `
            UPDATE products SET
                category_id = ?,
                name = ?,
                description = ?,
                price = ?,
                unit = ?,
                discount_percentage = ?,
                stock_quantity = ?,
                is_available = ?,
                is_featured = ?
        `;
        
        const params = [
            category_id, name, description, price, unit,
            discount_percentage, stock_quantity, is_available, is_featured
        ];
        
        if (req.file) {
            updateQuery += ', image_url = ?';
            params.push(`/uploads/${req.file.filename}`);
        }
        
        updateQuery += ' WHERE id = ?';
        params.push(id);
        
        await db.query(updateQuery, params);
        
        res.json({ success: true, message: 'Product updated successfully' });
        
    } catch (error) {
        console.error('Admin update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE /api/admin/products/:id
// Delete product
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM products WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Product deleted successfully' });
        
    } catch (error) {
        console.error('Admin delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ============================================
// ORDERS MANAGEMENT
// ============================================

// GET /api/admin/orders
// Get all orders
router.get('/orders', adminAuth, async (req, res) => {
    try {
        const { status, date } = req.query;
        
        let query = `
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
                u.mobile,
                u.name as customer_name,
                s.name as society_name,
                a.tower_no,
                a.flat_no
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN delivery_slots ds ON o.delivery_slot_id = ds.id
            JOIN addresses a ON o.address_id = a.id
            JOIN societies s ON a.society_id = s.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND o.order_status = ?';
            params.push(status);
        }
        
        if (date) {
            query += ' AND o.delivery_date = ?';
            params.push(date);
        }
        
        query += ' ORDER BY o.created_at DESC';
        
        const [orders] = await db.query(query, params);
        
        res.json({ orders });
        
    } catch (error) {
        console.error('Admin get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// PUT /api/admin/orders/:id/status
// Update order status
router.put('/orders/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { order_status, payment_status, delivery_boy_name } = req.body;
        
        const updates = [];
        const params = [];
        
        if (order_status) {
            updates.push('order_status = ?');
            params.push(order_status);
        }
        
        if (payment_status) {
            updates.push('payment_status = ?');
            params.push(payment_status);
        }
        
        if (delivery_boy_name) {
            updates.push('delivery_boy_name = ?');
            params.push(delivery_boy_name);
        }
        
        params.push(id);
        
        await db.query(
            `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        res.json({ success: true, message: 'Order updated successfully' });
        
    } catch (error) {
        console.error('Admin update order error:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// ============================================
// DASHBOARD STATS
// ============================================

// GET /api/admin/stats
// Get dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
    try {
        // Today's orders
        const [todayOrders] = await db.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
            FROM orders
            WHERE DATE(created_at) = CURDATE() AND order_status != 'cancelled'
        `);
        
        // Pending orders
        const [pendingOrders] = await db.query(`
            SELECT COUNT(*) as count
            FROM orders
            WHERE order_status = 'pending'
        `);
        
        // Low stock products
        const [lowStock] = await db.query(`
            SELECT COUNT(*) as count
            FROM products
            WHERE stock_quantity < 10 AND is_available = TRUE
        `);
        
        // Total customers
        const [totalCustomers] = await db.query(`
            SELECT COUNT(*) as count FROM users WHERE is_verified = TRUE
        `);
        
        res.json({
            today_orders: todayOrders[0].count,
            today_revenue: todayOrders[0].revenue,
            pending_orders: pendingOrders[0].count,
            low_stock_products: lowStock[0].count,
            total_customers: totalCustomers[0].count
        });
        
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============================================
// SOCIETIES MANAGEMENT
// ============================================

// POST /api/admin/societies
// Add new society
router.post('/societies', adminAuth, async (req, res) => {
    try {
        const { name, area, pincode } = req.body;
        
        const [result] = await db.query(
            'INSERT INTO societies (name, area, pincode) VALUES (?, ?, ?)',
            [name, area, pincode]
        );
        
        res.json({ 
            success: true, 
            message: 'Society added successfully',
            society_id: result.insertId
        });
        
    } catch (error) {
        console.error('Admin add society error:', error);
        res.status(500).json({ error: 'Failed to add society' });
    }
});

module.exports = router;
