# SpendTracker

iOS app that tracks purchases by intercepting Indian bank SMS via Apple's `ILMessageFilterExtension`, parsing them on a TypeScript backend, and displaying spending analytics in SwiftUI.

## Architecture

Three components:

1. **MessageFilterExtension** (Swift) — iOS Message Filter Extension that intercepts SMS from unknown senders (Indian bank short codes like `VM-HDFCBK`). Performs a quick local heuristic check, then defers to the backend via `.needsNetworkAction`.

2. **Backend** (TypeScript/Express) — Receives SMS from Apple's filter system at `POST /api/filter-sms`, parses transaction details (amount, type, bank, merchant, channel, UPI/IMPS refs, balance) using regex, stores in PostgreSQL via Prisma. Also serves transaction data and spending summaries to the iOS app.

3. **SpendTrackerApp** (SwiftUI) — Dashboard with spending/received totals, bank breakdown, and transaction list with filtering (type, bank, channel, date, amount, search).

## Project Structure

```
SpendTrackerApp/          # iOS app (SwiftUI, iOS 16+)
  SpendTrackerApp.swift   # @main entry point
  Models/Transaction.swift # Data models + API response types
  Services/APIService.swift # HTTP client (@MainActor, ObservableObject)
  Views/                   # DashboardView, TransactionListView, TransactionRow

MessageFilterExtension/   # ILMessageFilterExtension target
  MessageFilterExtension.swift  # SMS interception + local heuristic

Backend/                  # TypeScript backend
  src/index.ts            # Express server entry, CORS, optional API key auth
  src/routes/filterRoutes.ts    # POST /api/filter-sms (Apple's endpoint, no auth)
  src/routes/transactionRoutes.ts # GET/DELETE /api/transactions (with auth)
  src/services/smsParser.ts     # Indian bank SMS regex parser (core logic)
  src/models/transaction.ts     # Prisma client, CRUD, spending summary
  src/utils/bankMappings.ts     # Bank sender code -> name mappings
  prisma/schema.prisma          # PostgreSQL schema
```

## Tech Stack

- **iOS**: Swift, SwiftUI, IdentityLookup framework, iOS 16+ (for transaction SMS classification)
- **Backend**: TypeScript, Express, Prisma ORM, PostgreSQL, Zod
- **Dev tools**: `tsx watch` for backend hot reload, `tsc` for production build

## Key Commands

```bash
# Backend
cd Backend
npm install
npm run dev          # tsx watch src/index.ts
npm run build        # tsc
npm run db:migrate   # prisma migrate dev
npm run db:studio    # prisma studio

# SMS parser test
npx tsx src/services/smsParser.ts
```

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/filter-sms | None (Apple calls this) | Receive + parse SMS |
| GET | /api/transactions | Optional API key | List with filters |
| GET | /api/transactions/summary | Optional API key | Dashboard stats |
| DELETE | /api/transactions/:id | Optional API key | Remove false positive |
| GET | /health | None | Health check |

## Conventions

- Backend uses section comment separators: `// ─── Section Name ───`
- Swift uses `// MARK: -` for code organization
- Prisma model uses `cuid()` for IDs, `@@unique([sender, rawMessage])` for dedup
- SMS parser returns `null` for non-financial messages (fail-safe)
- Filter endpoint always returns `{ action: N }` — never errors to the client (returns action 0 on failure)
- APIService is `@MainActor` and `ObservableObject`, passed via `@EnvironmentObject`
- Indian bank sender codes follow pattern: `XX-BANKCODE` (2-char telecom prefix + bank identifier)

## Important Notes

- `POST /api/filter-sms` has NO auth — Apple's filter system cannot send custom headers. Secure via network-level controls.
- The extension only sees SMS from **unknown senders** — do not save bank sender IDs as contacts.
- `APIService.baseURL` is currently a placeholder (`https://your-server.com/api`) — must be updated for deployment.
- Duplicate SMS are silently ignored via Prisma unique constraint (P2002 error code).
