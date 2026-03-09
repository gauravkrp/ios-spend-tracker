import Foundation

// MARK: - API Service

@MainActor
class APIService: ObservableObject {
    // IMPORTANT: Update this to your actual backend URL
    // For local development with a physical device, use your Mac's local IP
    // For production, use your deployed server URL
    static let baseURL = "https://your-server.com/api"

    @Published var transactions: [Transaction] = []
    @Published var summary: SpendingSummary?
    @Published var isLoading = false
    @Published var error: String?

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    // MARK: - Fetch Transactions

    func fetchTransactions(filter: TransactionFilter = TransactionFilter()) async {
        isLoading = true
        error = nil

        var components = URLComponents(string: "\(Self.baseURL)/transactions")!
        var queryItems: [URLQueryItem] = [
            .init(name: "page", value: String(filter.page)),
            .init(name: "pageSize", value: String(filter.pageSize)),
        ]

        if let type = filter.type {
            queryItems.append(.init(name: "type", value: type.rawValue))
        }
        if let bank = filter.bank {
            queryItems.append(.init(name: "bank", value: bank))
        }
        if let channel = filter.channel {
            queryItems.append(.init(name: "channel", value: channel.rawValue))
        }
        if let from = filter.fromDate {
            queryItems.append(.init(name: "from", value: ISO8601DateFormatter().string(from: from)))
        }
        if let to = filter.toDate {
            queryItems.append(.init(name: "to", value: ISO8601DateFormatter().string(from: to)))
        }
        if let q = filter.searchQuery, !q.isEmpty {
            queryItems.append(.init(name: "q", value: q))
        }

        components.queryItems = queryItems

        do {
            let (data, response) = try await URLSession.shared.data(from: components.url!)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw APIError.badResponse
            }

            let result = try decoder.decode(TransactionsResponse.self, from: data)
            self.transactions = result.transactions
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Fetch Spending Summary

    func fetchSummary(days: Int = 30) async {
        do {
            let url = URL(string: "\(Self.baseURL)/transactions/summary?days=\(days)")!
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw APIError.badResponse
            }

            self.summary = try decoder.decode(SpendingSummary.self, from: data)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Delete Transaction

    func deleteTransaction(id: String) async -> Bool {
        do {
            var request = URLRequest(url: URL(string: "\(Self.baseURL)/transactions/\(id)")!)
            request.httpMethod = "DELETE"
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw APIError.badResponse
            }
            transactions.removeAll { $0.id == id }
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}

// MARK: - Errors

enum APIError: LocalizedError {
    case badResponse
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .badResponse: return "Invalid server response"
        case .unauthorized: return "Authentication required"
        }
    }
}
