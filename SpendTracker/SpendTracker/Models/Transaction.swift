import Foundation

// MARK: - Transaction Model

struct Transaction: Identifiable, Codable {
    let id: String
    let amount: Double
    let type: TransactionType
    let bank: String?
    let account: String?     // last 4 digits
    let card: String?        // last 4 digits
    let merchant: String?
    let channel: TransactionChannel?
    let upiRef: String?
    let balance: Double?
    let rawMessage: String
    let sender: String
    let createdAt: Date

    enum TransactionType: String, Codable, CaseIterable {
        case debit
        case credit
    }

    enum TransactionChannel: String, Codable, CaseIterable {
        case UPI
        case IMPS
        case NEFT
        case RTGS
        case POS
        case ATM
        case NETBANKING
        case UNKNOWN
    }
}

// MARK: - API Response Models

struct TransactionsResponse: Codable {
    let transactions: [Transaction]
    let total: Int
    let page: Int
    let pageSize: Int
}

struct SpendingSummary: Codable {
    let totalSpent: Double
    let totalReceived: Double
    let transactionCount: Int
    let byBank: [BankSummary]
    let byChannel: [ChannelSummary]
    let byDay: [DailySummary]
}

struct BankSummary: Codable, Identifiable {
    var id: String { bank }
    let bank: String
    let spent: Double
    let received: Double
    let count: Int
}

struct ChannelSummary: Codable, Identifiable {
    var id: String { channel }
    let channel: String
    let amount: Double
    let count: Int
}

struct DailySummary: Codable, Identifiable {
    var id: String { date }
    let date: String
    let spent: Double
    let received: Double
}

// MARK: - Filter / Query

struct TransactionFilter {
    var type: Transaction.TransactionType?
    var bank: String?
    var channel: Transaction.TransactionChannel?
    var fromDate: Date?
    var toDate: Date?
    var minAmount: Double?
    var maxAmount: Double?
    var searchQuery: String?
    var page: Int = 1
    var pageSize: Int = 50
}
