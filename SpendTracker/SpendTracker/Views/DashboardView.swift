import SwiftUI

struct DashboardView: View {
    @StateObject private var api = APIService()
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

        var label: String {
            switch self {
            case .week: return "This Week"
            case .month: return "This Month"
            case .quarter: return "3 Months"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Setup Banner
                    if api.transactions.isEmpty && !api.isLoading {
                        setupBanner
                    }

                    // Period Selector
                    Picker("Period", selection: $selectedPeriod) {
                        ForEach(TimePeriod.allCases, id: \.self) { period in
                            Text(period.rawValue).tag(period)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Overall Summary
                    if let summary = api.summary {
                        overallSummary(summary)
                    }

                    // Account Breakdown
                    if let summary = api.summary, !summary.byAccount.isEmpty {
                        accountBreakdownSection(summary.byAccount)
                    }

                    // Daily Breakdown
                    if let summary = api.summary, !summary.byDay.isEmpty {
                        dailyBreakdownSection(summary.byDay)
                    }

                    // Recent Transactions
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
                Task { await refresh() }
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

    // MARK: - Overall Summary

    private func overallSummary(_ summary: SpendingSummary) -> some View {
        VStack(spacing: 12) {
            Text(selectedPeriod.label)
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 24) {
                VStack(spacing: 4) {
                    Text("Total Debited")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("₹\(summary.totalSpent, specifier: "%.0f")")
                        .font(.title2.bold())
                        .foregroundStyle(.red)
                }

                Rectangle()
                    .fill(.quaternary)
                    .frame(width: 1, height: 40)

                VStack(spacing: 4) {
                    Text("Total Credited")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("₹\(summary.totalReceived, specifier: "%.0f")")
                        .font(.title2.bold())
                        .foregroundStyle(.green)
                }

                Rectangle()
                    .fill(.quaternary)
                    .frame(width: 1, height: 40)

                VStack(spacing: 4) {
                    Text("Txns")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("\(summary.transactionCount)")
                        .font(.title2.bold())
                        .foregroundStyle(.blue)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 8)
        )
        .padding(.horizontal)
    }

    // MARK: - Account Breakdown

    private func accountBreakdownSection(_ accounts: [AccountSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("By Account")
                .font(.headline)
                .padding(.horizontal)

            ForEach(accounts.sorted(by: { $0.spent > $1.spent })) { acct in
                HStack(spacing: 12) {
                    // Bank icon
                    ZStack {
                        Circle()
                            .fill(.blue.opacity(0.1))
                            .frame(width: 36, height: 36)
                        Text(String(acct.bank.prefix(2)))
                            .font(.caption.bold())
                            .foregroundStyle(.blue)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(acct.label)
                            .font(.subheadline.bold())
                        Text("\(acct.count) txns")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        if acct.spent > 0 {
                            Text("-₹\(acct.spent, specifier: "%.0f")")
                                .font(.subheadline.bold())
                                .foregroundStyle(.red)
                        }
                        if acct.received > 0 {
                            Text("+₹\(acct.received, specifier: "%.0f")")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 6)
            }
        }
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 8)
        )
        .padding(.horizontal)
    }

    // MARK: - Daily Breakdown

    private func dailyBreakdownSection(_ days: [DailySummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("By Day")
                .font(.headline)
                .padding(.horizontal)

            ForEach(days.reversed()) { day in
                HStack {
                    Text(formatDate(day.date))
                        .font(.subheadline)
                        .frame(width: 90, alignment: .leading)

                    Spacer()

                    if day.spent > 0 {
                        Text("-₹\(day.spent, specifier: "%.0f")")
                            .font(.subheadline.bold())
                            .foregroundStyle(.red)
                            .frame(width: 90, alignment: .trailing)
                    } else {
                        Text("—")
                            .font(.subheadline)
                            .foregroundStyle(.quaternary)
                            .frame(width: 90, alignment: .trailing)
                    }

                    if day.received > 0 {
                        Text("+₹\(day.received, specifier: "%.0f")")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                            .frame(width: 90, alignment: .trailing)
                    } else {
                        Text("—")
                            .font(.subheadline)
                            .foregroundStyle(.quaternary)
                            .frame(width: 90, alignment: .trailing)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 4)

                if day.id != days.first?.id {
                    Divider().padding(.horizontal)
                }
            }
        }
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.background)
                .shadow(color: .black.opacity(0.05), radius: 8)
        )
        .padding(.horizontal)
    }

    private func formatDate(_ isoDate: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: isoDate) else { return isoDate }
        let display = DateFormatter()
        display.dateFormat = "d MMM"
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        return display.string(from: date)
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

#Preview {
    DashboardView()
}
