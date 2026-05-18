# 🌐 .NET + Angular Integration Guide for WhatsApp API

This guide details how to implement the WhatsApp session management directly in your Angular frontend and delegate message sending (bulk/individual) to your .NET backend.

---

## 🏗️ System Architecture

To guarantee security, isolation, and robustness, your application should implement this architecture:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Angular as Angular App (Frontend)
    participant DotNet as .NET Web API (Backend)
    participant DB as SQL Database
    participant NodeApp as WhatsApp API (Node.js Service)

    %% Session Initialization
    User->>Angular: Click "Connect WhatsApp"
    Angular->>NodeApp: GET /init/LIB001 (Start Client Session)
    NodeApp-->>Angular: Status: INITIALIZING

    %% Polling Loop for QR Code
    loop Polling Status every 3 seconds
        Angular->>NodeApp: GET /status/LIB001
        NodeApp-->>Angular: Return State: "QR_RECEIVED" & qrCode: "data:image/png;base64,..."
        Angular->>User: Display QR Image on Screen
    end

    User->>Angular: Scan QR Code with Phone
    NodeApp-->>Angular: Status Changes to "CONNECTED"
    Angular->>User: Show "WhatsApp Connected Successfully!"

    %% Due Student Campaign (Backend Orchestration)
    User->>Angular: Click "Send Due Alerts"
    Angular->>DotNet: POST /api/campaign/due-alerts
    DotNet->>DB: Fetch students with outstanding balance
    DB-->>DotNet: List of students (phones, names, due amounts)
    DotNet->>NodeApp: POST /bulk-json (Bulk Dispatch with optional attachment)
    NodeApp-->>DotNet: Return Dispatch Summary
    DotNet-->>Angular: Return Success Response
```

---

## 🎨 Frontend Implementation (Angular)

Angular will directly call the WhatsApp Node.js service to initialize the session and poll the status to display the base64 QR Code dynamically.

### 1. Angular TypeScript Component (`whatsapp-connect.component.ts`)
```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface WhatsAppStatusResponse {
  connected: boolean;
  state: string;
  qrCode: string | null;
}

@Component({
  selector: 'app-whatsapp-connect',
  templateUrl: './whatsapp-connect.component.html',
  styleUrls: ['./whatsapp-connect.component.css']
})
export class WhatsappConnectComponent implements OnInit, OnDestroy {
  readonly WHATSAPP_API_URL = 'http://localhost:3000'; // Node.js API Address
  libraryId: string = 'LIB001'; // Custom ID per user/library

  connectionState: string = 'DISCONNECTED';
  qrCodeBase64: string | null = null;
  isConnected: boolean = false;
  
  private pollingSub?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.checkCurrentStatus();
  }

  // Step 1: Initialize Session
  connectWhatsApp(): void {
    this.connectionState = 'INITIALIZING';
    this.http.get(`${this.WHATSAPP_API_URL}/init/${this.libraryId}`).subscribe({
      next: () => {
        this.startPollingStatus();
      },
      error: (err) => {
        console.error('Initialization failed', err);
        this.connectionState = 'FAILED';
      }
    });
  }

  // Step 2: Poll Status every 3 seconds
  startPollingStatus(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }

    this.pollingSub = interval(3000)
      .pipe(
        switchMap(() => this.http.get<WhatsAppStatusResponse>(`${this.WHATSAPP_API_URL}/status/${this.libraryId}`))
      )
      .subscribe({
        next: (res) => {
          this.connectionState = res.state;
          this.isConnected = res.connected;
          this.qrCodeBase64 = res.qrCode;

          if (this.isConnected) {
            this.stopPolling();
          }
        },
        error: (err) => {
          console.error('Polling status failed', err);
        }
      });
  }

  checkCurrentStatus(): void {
    this.http.get<WhatsAppStatusResponse>(`${this.WHATSAPP_API_URL}/status/${this.libraryId}`).subscribe({
      next: (res) => {
        this.connectionState = res.state;
        this.isConnected = res.connected;
        if (this.connectionState === 'QR_RECEIVED' && res.qrCode) {
          this.qrCodeBase64 = res.qrCode;
          this.startPollingStatus();
        }
      }
    });
  }

  stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
```

### 2. Angular HTML Template (`whatsapp-connect.component.html`)
```html
<div class="whatsapp-card">
  <h2>WhatsApp Connection Manager</h2>
  
  <!-- Disconnected / Start -->
  <div *ngIf="connectionState === 'DISCONNECTED'">
    <p class="status-text">Status: 🔴 Disconnected</p>
    <button class="btn btn-connect" (click)="connectWhatsApp()">Connect WhatsApp</button>
  </div>

  <!-- Initializing -->
  <div *ngIf="connectionState === 'INITIALIZING'">
    <p class="status-text text-pulse">Status: 🟡 Setting up session, please wait...</p>
    <div class="spinner"></div>
  </div>

  <!-- QR Code Display -->
  <div *ngIf="connectionState === 'QR_RECEIVED' && qrCodeBase64" class="qr-container">
    <p class="status-text">Status: 📷 Scan the QR code below to connect</p>
    <img [src]="qrCodeBase64" alt="WhatsApp QR Code" class="qr-image" />
    <p class="note">Open WhatsApp > Linked Devices > Link a Device</p>
  </div>

  <!-- Connected State -->
  <div *ngIf="isConnected || connectionState === 'CONNECTED'" class="connected-container">
    <p class="status-text success">Status: 🟢 Connected successfully!</p>
    <div class="checkmark-icon">✓</div>
  </div>
</div>
```

---

## ⚙️ Backend Orchestration (.NET C#)

Your .NET Web API acts as a secure orchestrator. It queries your local database to identify students with outstanding due fees, formats the payload, and calls the Node.js API.

### 1. Campaign Data Models
```csharp
public class DueAlertRequest
{
    public string LibraryId { get; set; } = "LIB001";
    public string? AttachmentUrl { get; set; } // Optional PDF invoice or flyer URL
}

public class StudentDueInfo
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public decimal DueAmount { get; set; }
}

public class WhatsAppJsonPayload
{
    public string LibraryId { get; set; } = string.Empty;
    public List<WhatsAppMessageItem> Data { get; set; } = new();
    public string? AttachmentUrl { get; set; }
}

public class WhatsAppMessageItem
{
    public string Phone { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
```

### 2. Campaign Controller (`CampaignController.cs`)
```csharp
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;

[ApiController]
[Route("api/[controller]")]
public class CampaignController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private const string WhatsAppServiceUrl = "http://localhost:3000"; // Address of Node app

    public CampaignController(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient();
    }

    [HttpPost("due-alerts")]
    public async Task<IActionResult> SendDueAlerts([FromBody] DueAlertRequest request)
    {
        try
        {
            // 1. Fetch due students from your database (Mocked data here)
            var dueStudents = new List<StudentDueInfo>
            {
                new() { Name = "John Doe", Phone = "919876543210", DueAmount = 150.00m },
                new() { Name = "Jane Smith", Phone = "919876543211", DueAmount = 75.50m }
            };

            if (!dueStudents.Any())
            {
                return Ok(new { success = true, message = "No outstanding student balances found." });
            }

            // 2. Format custom messages dynamically
            var payload = new WhatsAppJsonPayload
            {
                LibraryId = request.LibraryId,
                AttachmentUrl = request.AttachmentUrl,
                Data = dueStudents.Select(s => new WhatsAppMessageItem
                {
                    Phone = s.Phone,
                    Message = $"Hello {s.Name},\n\nThis is a friendly reminder that you have an outstanding fee of *${s.DueAmount}* due. Please clear it at your earliest convenience.\n\nThank you!"
                }).ToList()
            };

            // 3. Dispatch bulk campaign to the WhatsApp Node.js Service
            var response = await _httpClient.PostAsJsonAsync($"{WhatsAppServiceUrl}/bulk-json", payload);

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<object>();
                return Ok(new { success = true, results = result });
            }

            var errorMsg = await response.Content.ReadAsStringAsync();
            return StatusCode((int)response.StatusCode, new { success = false, message = errorMsg });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }

    [HttpPost("individual-due")]
    public async Task<IActionResult> SendIndividualAlert([FromBody] StudentDueInfo student, [FromQuery] string libraryId)
    {
        try
        {
            var payload = new
            {
                libraryId = libraryId,
                number = student.Phone,
                message = $"Hello {student.Name},\n\nYour outstanding fee is *${student.DueAmount}*. Please find details attached."
            };

            var response = await _httpClient.PostAsJsonAsync($"{WhatsAppServiceUrl}/single-message", payload);

            if (response.IsSuccessStatusCode)
            {
                return Ok(new { success = true, message = "Alert sent successfully" });
            }

            var error = await response.Content.ReadAsStringAsync();
            return BadRequest(new { success = false, message = error });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
}
```
