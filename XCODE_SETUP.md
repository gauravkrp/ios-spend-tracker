# Xcode Project Setup Guide

## Step 1: Create the Xcode Project

1. Open Xcode → **File → New → Project**
2. Select **iOS → App**
3. Configure:
   - Product Name: `SpendTracker`
   - Team: Your Apple Developer account
   - Organization Identifier: `com.yourname` (e.g., `com.shwez`)
   - Interface: **SwiftUI**
   - Language: **Swift**
4. Save the project

## Step 2: Add the Message Filter Extension Target

1. **File → New → Target**
2. Select **iOS → Message Filter Extension**
3. Configure:
   - Product Name: `MessageFilterExtension`
   - Bundle Identifier: `com.yourname.SpendTracker.MessageFilterExtension`
4. When prompted to "Activate MessageFilterExtension scheme?", click **Activate**

## Step 3: Copy Source Files

### Main App Target (SpendTracker)
Copy these files into the `SpendTracker` group in Xcode:

```
SpendTrackerApp/
├── SpendTrackerApp.swift        → Replace the generated App file
├── Models/
│   └── Transaction.swift
├── Views/
│   ├── DashboardView.swift      → Replace the generated ContentView
│   ├── TransactionListView.swift
│   └── TransactionRow.swift
└── Services/
    └── APIService.swift
```

### Extension Target (MessageFilterExtension)
Copy into the `MessageFilterExtension` group:

```
MessageFilterExtension/
├── MessageFilterExtension.swift  → Replace the generated file
├── Info.plist                    → Replace (or update the network URL)
└── MessageFilterExtension.entitlements
```

## Step 4: Configure the Extension's Network URL

In `MessageFilterExtension/Info.plist`, update:

```xml
<key>ILMessageFilterExtensionNetworkURL</key>
<string>https://your-actual-server.com/api/filter-sms</string>
```

This is the URL Apple will POST SMS content to when the extension defers to network.

> **For local development:** Use a tunneling service like ngrok:
> ```bash
> ngrok http 3000
> # Then use the ngrok URL: https://xxxx.ngrok.io/api/filter-sms
> ```

## Step 5: Link the IdentityLookup Framework

1. Select the **MessageFilterExtension** target
2. Go to **General → Frameworks and Libraries**
3. Verify `IdentityLookup.framework` is listed (it should be added automatically)

## Step 6: Configure App Groups (Optional but Recommended)

If you want the main app and extension to share data locally:

1. Select the **SpendTracker** target → Signing & Capabilities
2. Click **+ Capability → App Groups**
3. Add: `group.com.yourname.SpendTracker`
4. Do the same for the **MessageFilterExtension** target

## Step 7: Update APIService Base URL

In `SpendTrackerApp/Services/APIService.swift`, update:

```swift
static let baseURL = "https://your-actual-server.com/api"
```

## Step 8: Build & Run

1. Select a **physical iPhone** (extensions don't work in Simulator)
2. Build and run the SpendTracker scheme
3. The extension will be installed alongside the app

## Step 9: Enable the Filter on iPhone

On your iPhone:

1. **Settings → Messages**
2. Tap **Unknown & Spam**
3. Enable **SMS Filtering**
4. Under "SMS Filter", select **SpendTracker**

## Testing

### Quick Test Without a Real SMS
You can test the backend independently:

```bash
# Start the backend
cd Backend && npm run dev

# Send a test SMS payload (same format Apple uses)
curl -X POST http://localhost:3000/api/filter-sms \
  -H "Content-Type: application/json" \
  -d '{
    "_version": 1,
    "query": {
      "sender": "VM-HDFCBK",
      "message": {
        "text": "INR 2,450.00 debited from A/c XX1234 on 19-Feb-25. UPI Ref: 456789. Avl Bal: INR 34,567.89 - HDFC Bank"
      }
    }
  }'
```

### Testing on Device
1. Send yourself an SMS from a number NOT in your contacts
2. The SMS body should contain bank transaction keywords
3. Check the backend logs to see if it was received and parsed

> **Note:** You can ask a friend to send you a test SMS formatted like a bank message,
> or use an SMS API service to send test messages from an alphanumeric sender ID.

## Common Issues

### Extension Not Receiving SMS
- Ensure the filter is enabled in Settings → Messages → Unknown & Spam
- The sender must NOT be in your contacts
- The extension only works on physical devices, not Simulator
- Check that the `ILMessageFilterExtensionNetworkURL` is correct and reachable

### Network Requests Failing
- The URL must be HTTPS (Apple requires App Transport Security)
- For development, you can add ATS exceptions in Info.plist
- Use ngrok or similar for local development

### SMS Not Being Parsed
- Check backend logs for the raw SMS content
- Some banks use unique formats — you may need to add patterns to the parser
- Run the parser test: `cd Backend && npx tsx src/services/smsParser.ts`
