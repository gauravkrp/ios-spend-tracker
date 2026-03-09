import SwiftUI

struct DashboardView: View {
    @StateObject private var api = APIService()
    @State private var selectedTab = 0
    @State private var selectedPeriod: TimePeriod = .month

    enum TimePeriod: String, CaseIterable {
        case week = "7D"
        case month = "30D"
        case quarter = "90D"

        var days: Int {
            switch self {
            case .week: return 7
            case .month: return 30
            case .quarter: return 90
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // MARK: - Setup Banner
                    if api.transactions.isEmpty && !api.isLoading {
                        setupBanner
                    }

                    // MARK: - Period Selector
                    Picker("Period", selection: $selectedPeriod) {
                        ForEach(TimePeriod.allCases, id: \.self) { period in
                            Text(period.rawValue).tag(period)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // MARK: - Summary Cards
                    if let summary = api.summary {
                        summaryCards(summary)
                    }

                    // MARK: - Bank Breakdown
                    if let summary = api.summary, !summary.byBank.isEmpty {
                        bankBreakdownSection(summary.byBank)
                    }

                    // MARK: - Recent Transactions
                    recentTransactionsSection
                }
                .padding(.vertical)
            }
            .navigationTitle("SpendTracker")
            .refreshable {
                await refresh()
            }
            .task {
                await refresh()
            }
            .onChange(of: selectedPeriod) {
                Task { await api.fetchSummary(days: selectedPeriod.days) }
            }
        }
    }

    // MARK: - Setup Banner

    private var setupBanner: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Enable SMS Filtering", systemImage: "envelope.badge.shield.half.filled")
                .font(.headline)

            Text("To track your purchases, enable SMS filtering:")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 6) {
                StepRow(number: 1, text: "Open Settings → Messages")
                StepRow(number: 2, text: "Tap Unknown & Spam")
                StepRow(number: 3, text: "Enable SMS Filtering")
                StepRow(number: 4, text: "Select SpendTracker")
            }
            .font(.caption)

            Text("Only bank SMS from unknown senders will be processed. Your personal messages are never read.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.blue.opacity(0.08))
        )
        .padding(.horizontal)
    }

    // MARK: - Summary Cards

    private func summaryCards(_ summary: SpendingSummary) -> some View {
        HStack(spacing: 12) {
            SummaryCard(
                title: "Spent",
                amount: summary.totalSpent,
                icon: "arrow.up.circle.fill",
                color: .red
            )
            SummaryCard(
                title: "Received",
                amount: summary.totalReceived,
                icon: "arrow.down.circle.fill",
                color: .green
            )
            SummaryCard(
                title: "Txns",
                amount: Double(summary.transactionCount),
                icon: "number.circle.fill",
                color: .blue,
                isCount: true
            )
        }
        .padding(.horizontal)
    }

    // MARK: - Bank Breakdown

    private func bankBreakdownSection(_ banks: [BankSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("By Bank")
                .font(.headline)
                .padding(.horizontal)

            ForEach(banks.sorted(by: { $0.spent > $1.spent })) { bank in
                HStack {
                    VStack(alignment: .leading) {
                        Text(bank.bank)
                            .font(.subheadline.bold())
                        Text("\(bank.count) transactions")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text("₹\(bank.spent, specifier: "%.0f")")
                            .font(.subheadline.bold())
                            .foregroundStyle(.red)
                        if bank.received > 0 {
                            Text("+₹\(bank.received, specifier: "%.0f")")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
        }
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 8)
        )
        .padding(.horizontal)
    }

    // MARK: - Recent Transactions

    private var recentTransactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent")
                    .font(.headline)
                Spacer()
                NavigationLink("See All") {
                    TransactionListView()
                        .environmentObject(api)
                }
                .font(.subheadline)
            }
            .padding(.horizontal)

            if api.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else if api.transactions.isEmpty {
                ContentUnavailableView(
                    "No transactions yet",
                    systemImage: "creditcard",
                    description: Text("Transactions will appear here as bank SMS arrive")
                )
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(api.transactions.prefix(10)) { txn in
                        TransactionRow(transaction: txn)
                        if txn.id != api.transactions.prefix(10).last?.id {
                            Divider().padding(.leading, 56)
                        }
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(.background)
                        .shadow(color: .black.opacity(0.05), radius: 8)
                )
                .padding(.horizontal)
            }
        }
    }

    // MARK: - Refresh

    private func refresh() async {
        await api.fetchSummary(days: selectedPeriod.days)
        await api.fetchTransactions()
    }
}

// MARK: - Supporting Views

struct StepRow: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Text("\(number)")
                .font(.caption2.bold())
                .frame(width: 20, height: 20)
                .background(Circle().fill(.blue.opacity(0.15)))
            Text(text)
        }
    }
}

struct SummaryCard: View {
    let title: String
    let amount: Double
    let icon: String
    let color: Color
    var isCount: Bool = false

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)

            if isCount {
                Text("\(Int(amount))")
                    .font(.title3.bold())
            } else {
                Text("₹\(amount, specifier: "%.0f")")
                    .font(.subheadline.bold())
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 8)
        )
    }
}

#Preview {
    DashboardView()
}
