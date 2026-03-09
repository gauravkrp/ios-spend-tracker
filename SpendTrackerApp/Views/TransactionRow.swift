import SwiftUI

struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(transaction.type == .debit ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: iconName)
                    .font(.system(size: 16))
                    .foregroundStyle(transaction.type == .debit ? .red : .green)
            }

            // Details
            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.merchant ?? transaction.channel?.rawValue ?? "Transaction")
                    .font(.subheadline.bold())
                    .lineLimit(1)

                HStack(spacing: 4) {
                    if let bank = transaction.bank {
                        Text(bank)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let account = transaction.account ?? transaction.card {
                        Text("••\(account)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }

                Text(transaction.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            // Amount
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(transaction.type == .debit ? "-" : "+")₹\(transaction.amount, specifier: "%.2f")")
                    .font(.subheadline.bold())
                    .foregroundStyle(transaction.type == .debit ? .red : .green)

                if let channel = transaction.channel, channel != .UNKNOWN {
                    Text(channel.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule().fill(.gray.opacity(0.1))
                        )
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
    }

    private var iconName: String {
        guard let channel = transaction.channel else {
            return transaction.type == .debit ? "arrow.up.right" : "arrow.down.left"
        }
        switch channel {
        case .UPI: return "qrcode"
        case .POS: return "creditcard"
        case .ATM: return "banknote"
        case .IMPS, .NEFT, .RTGS: return "arrow.left.arrow.right"
        case .NETBANKING: return "globe"
        case .UNKNOWN: return transaction.type == .debit ? "arrow.up.right" : "arrow.down.left"
        }
    }
}

#Preview {
    TransactionRow(transaction: Transaction(
        id: "1",
        amount: 2450.00,
        type: .debit,
        bank: "HDFC Bank",
        account: "1234",
        card: nil,
        merchant: "Swiggy",
        channel: .UPI,
        upiRef: "456789012",
        balance: 34567.89,
        rawMessage: "INR 2,450.00 debited from A/c XX1234...",
        sender: "VM-HDFCBK",
        createdAt: Date()
    ))
    .padding()
}
