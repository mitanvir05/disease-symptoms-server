require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db'); // Import DB connection

// 1. Connect to Database
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// 2. Define Routes
app.use('/api/analyze', require('./routes/analyzeRoutes')); // <--- ADD THIS LINE

app.get('/', (req, res) => {
  res.json({ message: "Thesis API is running!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));