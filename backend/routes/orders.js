const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Place order
router.post("/", async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      user_id,
      society_id,
      delivery_address,
      delivery_slot_id,
      items,
      subtotal,
      discount_amount,
      delivery_fee,
      total_amount,
      payment_method,
      special_instructions,
    } = req.body;

    // Validate required fields
    if (
      !user_id ||
      !society_id ||
      !delivery_address ||
      !delivery_slot_id ||
      !items ||
      items.length === 0
    ) {
      await connection.rollback();
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check stock availability for all items BEFORE creating order
    for (const item of items) {
      const [product] = await connection.query(
        "SELECT stock_quantity, name FROM products WHERE id = ?",
        [item.product_id],
      );

      if (product.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: `Product ID ${item.product_id} not found`,
        });
      }

      if (product[0].stock_quantity < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          error: `Insufficient stock for ${product[0].name}. Available: ${product[0].stock_quantity}, Requested: ${item.quantity}`,
        });
      }
    }

    // Generate order number
    const orderNumber = "ORD" + Date.now();

    // Create order
    const [orderResult] = await connection.query(
      `INSERT INTO orders (
                user_id, society_id, delivery_address, delivery_slot_id,
                order_number, subtotal, discount_amount, delivery_fee, total_amount,
                payment_method, payment_status, order_status, special_instructions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
      [
        user_id,
        society_id,
        delivery_address,
        delivery_slot_id,
        orderNumber,
        subtotal,
        discount_amount || 0,
        delivery_fee || 0,
        total_amount,
        payment_method,
        special_instructions || "",
      ],
    );

    const orderId = orderResult.insertId;

    // Insert order items and deduct stock
    for (const item of items) {
      // Insert order item
      await connection.query(
        `INSERT INTO order_items (
                    order_id, product_id, quantity, unit_price, discount_amount, total_price
                ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.discount_amount || 0,
          item.total_price,
        ],
      );

      // Get current stock
      const [currentStock] = await connection.query(
        "SELECT stock_quantity FROM products WHERE id = ?",
        [item.product_id],
      );

      const oldQuantity = currentStock[0].stock_quantity;
      const newQuantity = oldQuantity - item.quantity;

      // Deduct stock from products table
      await connection.query(
        "UPDATE products SET stock_quantity = ? WHERE id = ?",
        [newQuantity, item.product_id],
      );

      // Record stock history
      await connection.query(
        `INSERT INTO stock_history (
                    product_id, change_type, quantity_change, 
                    old_quantity, new_quantity, order_id, 
                    notes, created_by
                ) VALUES (?, 'order', ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          -item.quantity,
          oldQuantity,
          newQuantity,
          orderId,
          `Stock deducted for order ${orderNumber}`,
          `user_${user_id}`,
        ],
      );
    }

    await connection.commit();

    res.json({
      success: true,
      order_id: orderId,
      order_number: orderNumber,
      message: "Order placed successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Order placement error:", error);
    res.status(500).json({ error: "Failed to place order" });
  } finally {
    connection.release();
  }
});

// Get user orders
router.get("/my-orders", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "user_id required" });
    }

    const [orders] = await db.query(
      `SELECT o.*, s.name as society_name, ds.slot_time
             FROM orders o
             LEFT JOIN societies s ON o.society_id = s.id
             LEFT JOIN delivery_slots ds ON o.delivery_slot_id = ds.id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`,
      [user_id],
    );

    // Get items for each order
    for (let order of orders) {
      const [items] = await db.query(
        `SELECT oi.*, p.name as product_name, p.unit, p.image_url
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
        [order.id],
      );
      order.items = items;
    }

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get single order details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [orders] = await db.query(
      `SELECT o.*, s.name as society_name, ds.slot_time,
                    u.name as customer_name, u.mobile
             FROM orders o
             LEFT JOIN societies s ON o.society_id = s.id
             LEFT JOIN delivery_slots ds ON o.delivery_slot_id = ds.id
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.id = ?`,
      [id],
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];

    // Get order items
    const [items] = await db.query(
      `SELECT oi.*, p.name as product_name, p.unit, p.image_url
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
      [id],
    );

    order.items = items;

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

module.exports = router;
