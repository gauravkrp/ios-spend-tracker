import SwiftUI

struct TransactionListView: View {
    @EnvironmentObject var api: APIService
    @State private var filter = TransactionFilter()
    @State private var searchText = ""
    @State private var showFilters = false
    @State private var selectedType: Transaction.TransactionType?

    var body: some View {
        List {
            // Quick filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(title: "All", isSelected: selectedType == nil) {
                        selectedType = nil
                        filter.type = nil
                        Task { await api.fetchTransactions(filter: filter) }
                    }
                    FilterChip(title: "Debits", isSelected: selectedType == .debit) {
                        selectedType = .debit
                        filter.type = .debit
                        Task { await api.fetchTransactions(filter: filter) }
                    }
                    FilterChip(title: "Credits", isSelected: selectedType == .credit) {
                        selectedType = .credit
                        filter.type = .credit
                        Task { await api.fetchTransactions(filter: filter) }
                    }
                }
                .padding(.vertical, 4)
            }
            .listRowSeparator(.hidden)

            // Transaction rows
            ForEach(api.transactions) { txn in
                TransactionRow(transaction: txn)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Task { let _ = await api.deleteTransaction(id: txn.id) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }

            if api.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Transactions")
        .searchable(text: $searchText, prompt: "Search merchant, bank...")
        .onSubmit(of: .search) {
            filter.searchQuery = searchText
            Task { await api.fetchTransactions(filter: filter) }
        }
        .refreshable {
            await api.fetchTransactions(filter: filter)
        }
    }
}

// MARK: - Filter Chip

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isSelected ? Color.accentColor : Color.gray.opacity(0.12))
                )
                .foregroundStyle(isSelected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        TransactionListView()
            .environmentObject(APIService())
    }
}
