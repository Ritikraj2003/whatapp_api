const express = require('express');
const router = express.Router();
const whatsAppController = require('../controllers/whatsapp.controller');
const multer = require('multer');
const path = require('path');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Define upload configuration for multiple files (used in bulk-message)
const bulkUploadFields = upload.fields([
    { name: 'file', maxCount: 1 },        // Excel spreadsheet file
    { name: 'attachment', maxCount: 1 }   // Optional media attachment file
]);

// Routes
router.get('/init/:libraryId', whatsAppController.init);
router.post('/init/:libraryId', whatsAppController.init);
router.get('/status/:libraryId', whatsAppController.status);
router.delete('/logout/:libraryId', whatsAppController.logout);
router.post('/logout/:libraryId', whatsAppController.logout); // fallback for clients that don't support DELETE

// Kill session (destroy browser, keep disk session — reconnects without QR on next /init)
router.delete('/kill/:libraryId', whatsAppController.kill);
router.post('/kill/:libraryId', whatsAppController.kill); // fallback for Angular HttpClient

// Single Message Endpoints
router.post('/single-message', upload.single('file'), whatsAppController.singleMessage);

// Bulk Message Endpoints
router.post('/bulk-message', bulkUploadFields, whatsAppController.bulkMessage);
router.post('/bulk-json', whatsAppController.bulkJson);

// Registration Success Endpoint
router.post('/registration-success', upload.single('file'), whatsAppController.registrationSuccess);

module.exports = router;
