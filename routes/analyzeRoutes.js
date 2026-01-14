// server/routes/analyzeRoutes.js
const express = require('express');
const router = express.Router();
const { analyzeSymptoms } = require('../controllers/analyzeController');

router.post('/', analyzeSymptoms);

module.exports = router;