const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.post('/add-point', async (req, res) => {
  const { userId } = req.body;
  try {
    await pool.query('UPDATE users SET points = points + 1 WHERE id = $1', [userId]);
    res.send({ message: "تم إضافة نقطة" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
