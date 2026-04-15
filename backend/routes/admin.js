const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

// Apply auth to all admin routes
router.use(authenticateAdmin);

// Get all products
router.get("/products", async (req, res) => {
  try {
    const [products] = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.id DESC
        `);

    res.json({ success: true, products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Add product
router.post("/products", async (req, res) => {
  try {
    const {
      category_id,
      name,
      description,
      price,
      unit,
      discount_percentage,
      stock_quantity,
      is_available,
      is_featured,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO products (
                category_id, name, description, price, unit, 
                discount_percentage, stock_quantity, is_available, is_featured
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id,
        name,
        description || "",
        price,
        unit,
        discount_percentage || 0,
        stock_quantity,
        is_available ? 1 : 0,
        is_featured ? 1 : 0,
      ],
    );

    // Record initial stock in history
    await db.query(
      `INSERT INTO stock_history (
                product_id, change_type, quantity_change, 
                old_quantity, new_quantity, notes, created_by
            ) VALUES (?, 'restock', ?, 0, ?, ?, 'admin')`,
      [result.insertId, stock_quantity, stock_quantity, "Initial stock"],
    );

    res.json({ success: true, product_id: result.insertId });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Update product
router.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      name,
      description,
      price,
      unit,
      discount_percentage,
      stock_quantity,
      is_available,
      is_featured,
    } = req.body;

    // Get current stock for comparison
    const [currentProduct] = await db.query(
      "SELECT stock_quantity FROM products WHERE id = ?",
      [id],
    );

    if (currentProduct.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const oldStock = currentProduct[0].stock_quantity;
    const stockChange = stock_quantity - oldStock;

    // Update product
    await db.query(
      `UPDATE products SET 
                category_id = ?, name = ?, description = ?, price = ?, unit = ?,
                discount_percentage = ?, stock_quantity = ?, 
                is_available = ?, is_featured = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      [
        category_id,
        name,
        description || "",
        price,
        unit,
        discount_percentage || 0,
        stock_quantity,
        is_available ? 1 : 0,
        is_featured ? 1 : 0,
        id,
      ],
    );

    // Record stock change if quantity changed
    if (stockChange !== 0) {
      await db.query(
        `INSERT INTO stock_history (
                    product_id, change_type, quantity_change, 
                    old_quantity, new_quantity, notes, created_by
                ) VALUES (?, 'adjustment', ?, ?, ?, ?, 'admin')`,
        [
          id,
          stockChange,
          oldStock,
          stock_quantity,
          "Manual adjustment via admin",
        ],
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product
router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM products WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Restock product (add stock)
router.post("/products/:id/restock", async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { quantity, notes } = req.body;

    if (!quantity || quantity <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Invalid quantity" });
    }

    // Get current stock
    const [product] = await connection.query(
      "SELECT stock_quantity, name FROM products WHERE id = ?",
      [id],
    );

    if (product.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    const oldQuantity = product[0].stock_quantity;
    const newQuantity = oldQuantity + quantity;

    // Update stock
    await connection.query(
      "UPDATE products SET stock_quantity = ? WHERE id = ?",
      [newQuantity, id],
    );

    // Record in history
    await connection.query(
      `INSERT INTO stock_history (
                product_id, change_type, quantity_change, 
                old_quantity, new_quantity, notes, created_by
            ) VALUES (?, 'restock', ?, ?, ?, ?, 'admin')`,
      [id, quantity, oldQuantity, newQuantity, notes || "Stock replenishment"],
    );

    await connection.commit();

    res.json({
      success: true,
      product_name: product[0].name,
      old_stock: oldQuantity,
      new_stock: newQuantity,
      added: quantity,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error restocking product:", error);
    res.status(500).json({ error: "Failed to restock product" });
  } finally {
    connection.release();
  }
});

// Get stock history
router.get("/stock-history", async (req, res) => {
  try {
    const { product_id, change_type, limit = 100 } = req.query;

    let query = `
            SELECT sh.*, p.name as product_name
            FROM stock_history sh
            JOIN products p ON sh.product_id = p.id
            WHERE 1=1
        `;
    const params = [];

    if (product_id) {
      query += " AND sh.product_id = ?";
      params.push(product_id);
    }

    if (change_type) {
      query += " AND sh.change_type = ?";
      params.push(change_type);
    }

    query += " ORDER BY sh.created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    const [history] = await db.query(query, params);

    res.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching stock history:", error);
    res.status(500).json({ error: "Failed to fetch stock history" });
  }
});

// Get low stock products
router.get("/low-stock", async (req, res) => {
  try {
    const { threshold = 10 } = req.query;

    const [products] = await db.query(
      `SELECT p.*, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.stock_quantity < ?
             ORDER BY p.stock_quantity ASC`,
      [threshold],
    );

    res.json({ success: true, products });
  } catch (error) {
    console.error("Error fetching low stock products:", error);
    res.status(500).json({ error: "Failed to fetch low stock products" });
  }
});

// Add category
router.post("/categories", async (req, res) => {
  try {
    const { name } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, "-");

    const [result] = await db.query(
      "INSERT INTO categories (name, slug) VALUES (?, ?)",
      [name, slug],
    );

    res.json({ success: true, category_id: result.insertId });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ error: "Failed to add category" });
  }
});

// Get all orders
router.get("/orders", async (req, res) => {
  try {
    const { status, date } = req.query;

    let query = `
            SELECT o.*, u.mobile, u.name as customer_name,
                   s.name as society_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN societies s ON o.society_id = s.id
        `;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("o.order_status = ?");
      params.push(status);
    }

    if (date) {
      conditions.push("DATE(o.created_at) = ?");
      params.push(date);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY o.created_at DESC";

    const [orders] = await db.query(query, params);

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Update order status
router.put("/orders/:id/status", async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { order_status, payment_status, delivery_boy_name } = req.body;

    // Get current order status
    const [currentOrder] = await connection.query(
      "SELECT order_status FROM orders WHERE id = ?",
      [id],
    );

    if (currentOrder.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const oldStatus = currentOrder[0].order_status;

    // If order is being cancelled, restore stock
    if (order_status === "cancelled" && oldStatus !== "cancelled") {
      const [orderItems] = await connection.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
        [id],
      );

      for (const item of orderItems) {
        // Get current stock
        const [product] = await connection.query(
          "SELECT stock_quantity FROM products WHERE id = ?",
          [item.product_id],
        );

        const oldQuantity = product[0].stock_quantity;
        const newQuantity = oldQuantity + item.quantity;

        // Restore stock
        await connection.query(
          "UPDATE products SET stock_quantity = ? WHERE id = ?",
          [newQuantity, item.product_id],
        );

        // Record in history
        await connection.query(
          `INSERT INTO stock_history (
                        product_id, change_type, quantity_change, 
                        old_quantity, new_quantity, order_id, 
                        notes, created_by
                    ) VALUES (?, 'return', ?, ?, ?, ?, ?, 'admin')`,
          [
            item.product_id,
            item.quantity,
            oldQuantity,
            newQuantity,
            id,
            `Stock restored - Order cancelled`,
          ],
        );
      }
    }

    // Update order
    const updates = [];
    const params = [];

    if (order_status) {
      updates.push("order_status = ?");
      params.push(order_status);
    }

    if (payment_status) {
      updates.push("payment_status = ?");
      params.push(payment_status);
    }

    if (delivery_boy_name !== undefined) {
      updates.push("delivery_boy_name = ?");
      params.push(delivery_boy_name);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await connection.query(
      `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    await connection.commit();

    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating order:", error);
    res.status(500).json({ error: "Failed to update order" });
  } finally {
    connection.release();
  }
});

// Add society
router.post("/societies", async (req, res) => {
  try {
    const { name, area, pincode } = req.body;

    const [result] = await db.query(
      "INSERT INTO societies (name, area, pincode) VALUES (?, ?, ?)",
      [name, area, pincode],
    );

    res.json({ success: true, society_id: result.insertId });
  } catch (error) {
    console.error("Error adding society:", error);
    res.status(500).json({ error: "Failed to add society" });
  }
});

// Get dashboard stats
router.get("/stats", async (req, res) => {
  try {
    // Today's orders
    const [todayOrders] = await db.query(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE DATE(created_at) = CURDATE()
        `);

    // Today's revenue
    const [todayRevenue] = await db.query(`
            SELECT COALESCE(SUM(total_amount), 0) as revenue 
            FROM orders 
            WHERE DATE(created_at) = CURDATE() 
            AND payment_status = 'completed'
        `);

    // Pending orders
    const [pendingOrders] = await db.query(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE order_status = 'pending'
        `);

    // Total customers
    const [totalCustomers] = await db.query(`
            SELECT COUNT(*) as count FROM users
        `);

    // Low stock products (below 10)
    const [lowStock] = await db.query(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE stock_quantity < 10 AND stock_quantity > 0
        `);

    // Out of stock
    const [outOfStock] = await db.query(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE stock_quantity = 0
        `);

    res.json({
      success: true,
      today_orders: todayOrders[0].count,
      today_revenue: todayRevenue[0].revenue,
      pending_orders: pendingOrders[0].count,
      total_customers: totalCustomers[0].count,
      low_stock_products: lowStock[0].count,
      out_of_stock_products: outOfStock[0].count,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
