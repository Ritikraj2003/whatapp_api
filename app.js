const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const whatsappRoutes = require('./routes/whatsapp.routes');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required directories exist
const dirs = ['uploads', 'sessions'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/', whatsappRoutes);

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ success: false, message: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`WhatsApp API Service running on port ${PORT}`);
    console.log(`=================================`);
});
