# 📱 WhatsApp API Service Documentation

This document lists all active endpoints, their required payloads, headers, content types, and example usage for integrating the WhatsApp API Service into your client applications.

---

## 🔑 Service Configuration
*   **Base URL**: `http://localhost:3000`
*   **Default Headers**: 
    *   For JSON requests: `Content-Type: application/json`
    *   For file uploads: `Content-Type: multipart/form-data`

---

## 📁 Endpoints Index

### Session Management
1.  [Initialize WhatsApp Session (`GET/POST /init/:libraryId`)](#1-initialize-whatsapp-session-getpost-initlibraryid)
2.  [Check Connection Status (`GET /status/:libraryId`)](#2-check-connection-status-get-statuslibraryid)

### Message Operations (All support optional attachments)
3.  [Single Message (`POST /single-message`)](#3-single-message-post-single-message)
4.  [Bulk Message from Excel (`POST /bulk-message`)](#4-bulk-message-from-excel-post-bulk-message)
5.  [Bulk Message from JSON (`POST /bulk-json`)](#5-bulk-message-from-json-post-bulk-json)
6.  [Registration Success Message (`POST /registration-success`)](#6-registration-success-message-post-registration-success)

---

## ⚡ Session Management

### 1. Initialize WhatsApp Session (`GET/POST /init/:libraryId`)
Initializes the Puppeteer-controlled WhatsApp instance for a given session/library. If a login is required, it waits for the browser to launch and directly returns the base64 QR code image in the initial HTTP response!

*   **URL**: `/init/:libraryId` (e.g. `/init/LIB001`)
*   **Method**: `GET` or `POST`
*   **Response Payload (If login is required):**
    ```json
    {
      "success": true,
      "status": "QR_RECEIVED",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
      "message": "Scan the QR code to connect"
    }
    ```
    *If already connected:*
    ```json
    {
      "success": true,
      "status": "CONNECTED",
      "qrCode": null,
      "message": "WhatsApp is connected and ready!"
    }
    ```

---

### 2. Check Connection Status (`GET /status/:libraryId`)
Retrieves the current status of the WhatsApp client.

*   **URL**: `/status/:libraryId` (e.g. `/status/LIB001`)
*   **Method**: `GET`
*   **Response Payload (If connected):**
    ```json
    {
      "connected": true,
      "state": "CONNECTED",
      "qrCode": null
    }
    ```
    *If not connected / waiting for scan:*
    ```json
    {
      "connected": false,
      "state": "QR_RECEIVED",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    }
    ```

---

## 💬 Message Operations

### 3. Single Message (`POST /single-message`)
Sends a message to a single phone number. Supports optional media attachments from three different sources: an uploaded file, a web URL, or a base64 string.

*   **URL**: `/single-message`
*   **Method**: `POST`
*   **Supported Content-Types**: `application/json` or `multipart/form-data`

#### Request Payload Properties
| Key | Type | Required? | Description |
|---|---|---|---|
| `libraryId` | String | **Yes** | Active WhatsApp session identifier. |
| `number` | String | **Yes** | Destination phone number (including country code, e.g. `919876543210`). |
| `message` | String | No | Text content of the message. Serves as the caption if an attachment is present. |
| `file` | File | No | Local media file uploaded via `multipart/form-data` (key name must be `file`). |
| `attachmentUrl` | String | No | Public web URL of a media file (image, PDF, doc, etc.) to fetch and send. |
| `attachmentBase64` | String | No | Base64 string of the file (supports format `data:mime/type;base64,...` or raw base64). |
| `attachmentMimeType` | String | No | MIME type (e.g., `image/png`). Required only if sending a raw base64 string without data URI. |
| `attachmentFileName` | String | No | Custom display filename for the attachment (e.g., `invoice.pdf`). |

#### Request Examples

##### A. Standard Text Message (JSON)
*   **Content-Type**: `application/json`
```json
{
  "libraryId": "LIB001",
  "number": "919876543210",
  "message": "Hello from the API!"
}
```

##### B. File Upload Attachment (FormData)
*   **Content-Type**: `multipart/form-data`
*   **Body Fields**:
    *   `libraryId`: `LIB001`
    *   `number`: `919876543210`
    *   `message`: `Here is your attached receipt.`
    *   `file`: *(File Upload Binary)*

##### C. Attachment via Web URL (JSON)
*   **Content-Type**: `application/json`
```json
{
  "libraryId": "LIB001",
  "number": "919876543210",
  "message": "Welcome! Please read our brochure.",
  "attachmentUrl": "https://example.com/assets/brochure.pdf"
}
```

##### D. Attachment via Base64 (JSON)
*   **Content-Type**: `application/json`
```json
{
  "libraryId": "LIB001",
  "number": "919876543210",
  "message": "Here is the captured snapshot.",
  "attachmentBase64": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "attachmentFileName": "snapshot.png"
}
```

#### Response Payload
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

---

### 4. Bulk Message from Excel (`POST /bulk-message`)
Upload an Excel file containing a recipient queue. Optionally upload a global attachment file (or provide a URL/base64 attachment) that will be sent to all recipients in the Excel sheet alongside their custom messages.

*   **URL**: `/bulk-message`
*   **Method**: `POST`
*   **Content-Type**: `multipart/form-data`

> [!IMPORTANT]
> **Excel Format Requirement:** The Excel spreadsheet must have a sheet containing columns named **`Phone`** (or `phone`) and **`Message`** (or `message`).
> | Phone | Message |
> |---|---|
> | `919876543210` | `Hi Alice, this is your customized message!` |
> | `919876543211` | `Hi Bob, this is your customized message!` |

#### Request Payload Properties
| Key | Type | Required? | Description |
|---|---|---|---|
| `libraryId` | String | **Yes** | Active WhatsApp session identifier. |
| `file` | File | **Yes** | The `.xlsx` Excel spreadsheet. |
| `attachment` | File | No | Media file to send to all contacts as part of the campaign (field name must be `attachment`). |
| `attachmentUrl` | String | No | Web URL of a media file to send to all. |
| `attachmentBase64` | String | No | Base64 string of the file to send to all. |
| `attachmentMimeType` | String | No | MIME type of base64 attachment. |
| `attachmentFileName` | String | No | Custom display filename for base64 attachment. |

#### Request Example (cURL)
```bash
curl -X POST http://localhost:3000/bulk-message \
  -F "libraryId=LIB001" \
  -F "file=@/path/to/recipients.xlsx" \
  -F "attachment=@/path/to/promo_flyer.jpg"
```

#### Response Payload
```json
{
  "success": true,
  "results": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "details": [
      { "phone": "919876543210", "status": "SUCCESS" },
      { "phone": "919876543211", "status": "SUCCESS" }
    ]
  }
}
```

---

### 5. Bulk Message from JSON (`POST /bulk-json`)
Send bulk messages using a direct JSON payload. You can also specify an optional attachment (via `attachmentUrl` or `attachmentBase64`) to send to every contact in the dataset.

*   **URL**: `/bulk-json`
*   **Method**: `POST`
*   **Content-Type**: `application/json`

#### Request Payload
```json
{
  "libraryId": "LIB001",
  "data": [
    {
      "phone": "919876543210",
      "message": "Hi Alice, your order is ready!"
    },
    {
      "phone": "919876543211",
      "message": "Hi Bob, your order is ready!"
    }
  ],
  "attachmentUrl": "https://example.com/receipt.pdf"
}
```

#### Response Payload
```json
{
  "success": true,
  "results": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "details": [
      { "phone": "919876543210", "status": "SUCCESS" },
      { "phone": "919876543211", "status": "SUCCESS" }
    ]
  }
}
```

---

### 6. Registration Success Message (`POST /registration-success`)
Sends a professional, customizable registration/signup success message along with their welcome document or certificate (as file, URL, or base64).

*   **URL**: `/registration-success`
*   **Method**: `POST`
*   **Supported Content-Types**: `application/json` or `multipart/form-data`

#### Request Payload Properties
| Key | Type | Required? | Description |
|---|---|---|---|
| `libraryId` | String | **Yes** | Active WhatsApp session identifier. |
| `number` / `phone` | String | **Yes** | Recipient's phone number. |
| `name` | String | No | Recipient's display name to personalize the default welcome template. |
| `message` | String | No | Custom message. If left blank, a premium, pre-styled template is sent automatically. |
| `file` | File | No | Local welcome packet / certificate file (field name must be `file`). |
| `attachmentUrl` | String | No | Web URL of the welcome packet to send. |
| `attachmentBase64` | String | No | Base64 string of the welcome packet. |

> [!TIP]
> **Dynamic Welcome Template:** If `message` is not provided, the API automatically generates this message:
> 
> *Hello {name},\n\n🎉 **Registration Successful!** 🎉\n\nThank you for registering with us. We are thrilled to welcome you to our community.\n\nWe have attached your welcome document/confirmation to this message. If you have any questions, feel free to reach out to us.\n\nBest regards,\nManagement Team*

#### Request Example (cURL with File)
```bash
curl -X POST http://localhost:3000/registration-success \
  -F "libraryId=LIB001" \
  -F "number=919876543210" \
  -F "name=Sophia Lauren" \
  -F "file=@/path/to/welcome_kit.pdf"
```

#### Response Payload
```json
{
  "success": true,
  "message": "Registration success message sent successfully"
}
```
