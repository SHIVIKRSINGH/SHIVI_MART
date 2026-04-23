// backend/routes/users.js

// router.put("/profile", async (req, res) => {
//   const userId = req.headers["user-id"];
//   const { name, address } = req.body;

//   if (!name || !address) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   await db.query("UPDATE users SET name=?, default_address=? WHERE id=?", [
//     name,
//     address,
//     userId,
//   ]);

//   res.json({ success: true });
// });
