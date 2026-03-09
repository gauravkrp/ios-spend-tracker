# SpendTracker – iOS SMS Purchase Tracker

Track all your purchases across Indian bank accounts and credit cards by intercepting transaction SMS using Apple's `ILMessageFilterExtension`.

## Architecture

```
┌──────────────────┐   SMS from unknown sender   ┌──────────────────────────┐
│   iOS SMS System  │ ─────────────────────────► │  MessageFilterExtension   │
│                   │                             │  (ILMessageFilterExt)     │
└──────────────────┘                             └───────────┬──────────────┘
                                                             │
                                                    returns .needsNetworkAction
                                                             │
                                                             ▼
                                                 ┌──────────────────────────┐
                                                 │   TypeScript Backend      │
                                                 │  POST /api/filter-sms    │
                                                 │  - receives sender+body  │
                                                 │  - parses transaction    │
                                                 │  - stores in PostgreSQL  │
                                                 │  - returns classification│
                                                 └───────────┬──────────────┘
                                                             │
                                                         sync/fetch
                                                             │
                                                             ▼
                                                 ┌──────────────────────────┐
                                                 │   SpendTracker App        │
                                                 │  - SwiftUI dashboard     │
                                                 │  - transactions list     │
                                                 │  - spending analytics    │
                                                 └──────────────────────────┘
```

## Project Structure

```
SpendTracker/
├── SpendTrackerApp/              # Main iOS app (SwiftUI)
│   ├── SpendTrackerApp.swift     # App entry point
│   ├── Models/
│   │   └── Transaction.swift     # Transaction data model
│   ├── Views/
│   │   ├── DashboardView.swift   # Main dashboard
│   │   ├── TransactionListView.swift
│   │   └── TransactionRow.swift
│   ├── Services/
│   │   └── APIService.swift      # Backend API client
│   └── Info.plist
│
├── MessageFilterExtension/       # ILMessageFilterExtension
│   ├── MessageFilterExtension.swift
│   ├── Info.plist
│   └── MessageFilterExtension.entitlements
│
└── Backend/                      # TypeScript backend
    ├── src/
    │   ├── index.ts              # Express server entry
    │   ├── routes/
    │   │   ├── filterRoutes.ts   # SMS filter endpoint (Apple calls this)
    │   │   └── transactionRoutes.ts
    │   ├── services/
    │   │   └── smsParser.ts      # Indian bank SMS parser
    │   ├── models/
    │   │   └── transaction.ts    # Prisma/DB model
    │   └── utils/
    │       └── bankMappings.ts   # Indian bank sender ID mappings
    ├── prisma/
    │   └── schema.prisma
    ├── package.json
    ├── tsconfig.json
    └── .env.example
```

## Setup

### 1. Backend

```bash
cd Backend
npm install
cp .env.example .env
# Edit .env with your database URL
npx prisma migrate dev
npm run dev
```

### 2. iOS App (Xcode)

1. Open Xcode → File → New → Project → App
2. Add a new target: File → New → Target → Message Filter Extension
3. Copy the Swift files from this project into the respective targets
4. Update the `ILMessageFilterExtensionNetworkURL` in the extension's Info.plist
5. Enable the "IdentityLookup" capability

### 3. User Setup (on iPhone)

1. Install the app
2. Go to **Settings → Messages → Unknown & Spam**
3. Enable **SMS Filtering**
4. Select **SpendTracker**

## Important Notes

- The extension only receives SMS from **unknown senders** (not in contacts)
- Indian bank SMS come from alphanumeric short codes (e.g., VM-HDFCBK) — these are always "unknown"
- **Do NOT save your bank's SMS sender as a contact**, or the extension won't see those messages
- The extension cannot access historical SMS — only new messages going forward
- Apple reviews Message Filter extensions carefully — ensure a clear privacy policy
