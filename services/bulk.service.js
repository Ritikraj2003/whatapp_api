const xlsx = require('xlsx');
const whatsAppService = require('./whatsapp.service');

class BulkService {
    async processBulkExcel(libraryId, filePath, attachmentOptions = {}) {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        return await this._sendBulk(libraryId, data, attachmentOptions);
    }

    async processBulkData(libraryId, data, attachmentOptions = {}) {
        return await this._sendBulk(libraryId, data, attachmentOptions);
    }

    async _sendBulk(libraryId, data, attachmentOptions = {}) {
        console.log(`[Bulk] Starting bulk process for ${libraryId} with ${data.length} messages.`);

        const results = {
            total: data.length,
            success: 0,
            failed: 0,
            details: []
        };

        for (const row of data) {
            const { Phone, Message } = row;
            // Handle case-insensitive keys if coming from JSON
            const phone = Phone !== undefined ? Phone : row.phone;
            const message = Message !== undefined ? Message : row.message;

            if (!phone) {
                results.failed++;
                results.details.push({ phone: null, status: 'FAILED', reason: 'Missing phone' });
                continue;
            }

            try {
                // Add a small delay between messages (2-5 seconds)
                const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
                await new Promise(resolve => setTimeout(resolve, delay));

                await whatsAppService.sendMessageWithAttachment(libraryId, phone.toString(), message || '', attachmentOptions);
                results.success++;
                results.details.push({ phone: phone, status: 'SUCCESS' });
            } catch (error) {
                console.error(`[Bulk] Failed to send to ${phone}:`, error.message);
                results.failed++;
                results.details.push({ phone: phone, status: 'FAILED', reason: error.message });
            }
        }

        return results;
    }
}

module.exports = new BulkService();
