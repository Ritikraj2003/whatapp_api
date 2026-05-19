const whatsAppService = require('../services/whatsapp.service');
const bulkService = require('../services/bulk.service');
const path = require('path');
const fs = require('fs');

class WhatsAppController {
    async init(req, res) {
        try {
            const { libraryId } = req.params;
            const result = await whatsAppService.initSession(libraryId);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async status(req, res) {
        try {
            const { libraryId } = req.params;
            const status = await whatsAppService.getStatus(libraryId);
            res.json(status);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async logout(req, res) {
        try {
            const { libraryId } = req.params;
            const result = await whatsAppService.logout(libraryId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async singleMessage(req, res) {
        try {
            const { libraryId, number, message, caption, attachmentUrl, attachmentBase64, attachmentMimeType, attachmentFileName } = req.body;
            const file = req.file;

            if (!libraryId || !number) {
                if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ success: false, message: 'Missing required fields libraryId or number' });
            }

            const msgText = message || caption || '';
            const attachmentOptions = {
                file,
                url: attachmentUrl,
                base64: attachmentBase64,
                mimetype: attachmentMimeType,
                filename: attachmentFileName
            };

            await whatsAppService.sendMessageWithAttachment(libraryId, number, msgText, attachmentOptions);

            // Clean up uploaded file after sending
            if (file && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            res.json({ success: true, message: 'Message sent successfully' });
        } catch (error) {
            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async bulkMessage(req, res) {
        try {
            const { libraryId, attachmentUrl, attachmentBase64, attachmentMimeType, attachmentFileName } = req.body;
            
            // Excel is in req.files['file'] ? req.files['file'][0] : null
            // Attachment is in req.files['attachment'] ? req.files['attachment'][0] : null
            const excelFile = req.files && req.files['file'] ? req.files['file'][0] : null;
            const attachmentFile = req.files && req.files['attachment'] ? req.files['attachment'][0] : null;

            if (!libraryId || !excelFile) {
                if (excelFile && fs.existsSync(excelFile.path)) fs.unlinkSync(excelFile.path);
                if (attachmentFile && fs.existsSync(attachmentFile.path)) fs.unlinkSync(attachmentFile.path);
                return res.status(400).json({ success: false, message: 'Missing libraryId or Excel file (field: file)' });
            }

            const attachmentOptions = {
                file: attachmentFile,
                url: attachmentUrl,
                base64: attachmentBase64,
                mimetype: attachmentMimeType,
                filename: attachmentFileName
            };

            const results = await bulkService.processBulkExcel(libraryId, excelFile.path, attachmentOptions);
            
            // Clean up Excel file
            if (fs.existsSync(excelFile.path)) {
                fs.unlinkSync(excelFile.path);
            }
            // Clean up Attachment file if present
            if (attachmentFile && fs.existsSync(attachmentFile.path)) {
                fs.unlinkSync(attachmentFile.path);
            }

            res.json({ success: true, results });
        } catch (error) {
            // Clean up files on error
            if (req.files) {
                const excelFile = req.files['file'] ? req.files['file'][0] : null;
                const attachmentFile = req.files['attachment'] ? req.files['attachment'][0] : null;
                if (excelFile && fs.existsSync(excelFile.path)) fs.unlinkSync(excelFile.path);
                if (attachmentFile && fs.existsSync(attachmentFile.path)) fs.unlinkSync(attachmentFile.path);
            }
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async bulkJson(req, res) {
        try {
            const { libraryId, data, attachmentUrl, attachmentBase64, attachmentMimeType, attachmentFileName } = req.body;

            if (!libraryId || !data || !Array.isArray(data)) {
                return res.status(400).json({ success: false, message: 'Missing libraryId or data array' });
            }

            const attachmentOptions = {
                url: attachmentUrl,
                base64: attachmentBase64,
                mimetype: attachmentMimeType,
                filename: attachmentFileName
            };

            const results = await bulkService.processBulkData(libraryId, data, attachmentOptions);
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async registrationSuccess(req, res) {
        try {
            const { libraryId, number, phone, name, message, attachmentUrl, attachmentBase64, attachmentMimeType, attachmentFileName } = req.body;
            const file = req.file;

            const targetNumber = number || phone;

            if (!libraryId || !targetNumber) {
                if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ success: false, message: 'Missing required fields libraryId or number' });
            }

            const displayName = name || 'Valued Member';
            const welcomeMsg = message || `Hello ${displayName},\n\n🎉 *Registration Successful!* 🎉\n\nThank you for registering with us. We are thrilled to welcome you to our community.\n\nWe have attached your welcome document/confirmation to this message. If you have any questions, feel free to reach out to us.\n\nBest regards,\nManagement Team`;

            const attachmentOptions = {
                file,
                url: attachmentUrl,
                base64: attachmentBase64,
                mimetype: attachmentMimeType,
                filename: attachmentFileName
            };

            await whatsAppService.sendMessageWithAttachment(libraryId, targetNumber, welcomeMsg, attachmentOptions);

            // Clean up uploaded file
            if (file && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            res.json({ success: true, message: 'Registration success message sent successfully' });
        } catch (error) {
            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new WhatsAppController();
