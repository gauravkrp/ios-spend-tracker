import IdentityLookup

/// MessageFilterExtension intercepts SMS from unknown senders.
/// Indian bank transaction SMS always come from alphanumeric short codes
/// (e.g., VM-HDFCBK, AD-ICICIB) which iOS treats as "unknown senders."
///
/// Flow:
/// 1. SMS arrives from unknown sender
/// 2. iOS invokes this extension
/// 3. We defer to our server (`.needsNetworkAction`)
/// 4. Server receives sender + body, parses transaction, stores it
/// 5. Server returns classification (transaction/promotion/junk)
/// 6. iOS categorizes the SMS accordingly
///
final class MessageFilterExtension: ILMessageFilterExtension {}

// MARK: - ILMessageFilterQueryHandling

extension MessageFilterExtension: ILMessageFilterQueryHandling {

    func handle(
        _ queryRequest: ILMessageFilterQueryRequest,
        context: ILMessageFilterExtensionContext,
        completion: @escaping (ILMessageFilterQueryResponse) -> Void
    ) {
        // Always defer to server for all unknown sender messages.
        // The server will determine if it's a financial SMS and store it.
        context.deferQueryRequestToNetwork { networkResponse, error in
            let finalResponse = ILMessageFilterQueryResponse()

            if let networkResponse = networkResponse,
               let json = try? JSONSerialization.jsonObject(with: networkResponse.data) as? [String: Any],
               let actionValue = json["action"] as? Int {
                // Map server action integer to ILMessageFilterAction
                switch actionValue {
                case 1: finalResponse.action = .allow
                case 2: finalResponse.action = .junk
                case 3: finalResponse.action = .promotion
                case 4: finalResponse.action = .transaction
                default: finalResponse.action = .none
                }
            } else {
                // Server unreachable or invalid response — allow through
                finalResponse.action = .none
            }

            completion(finalResponse)
        }
    }
}

// MARK: - ILMessageFilterExtensionNetworkHandling (for server communication)

extension MessageFilterExtension {

    /// Quick local heuristic to avoid unnecessary server calls.
    /// Only forward SMS that look like bank/financial messages.
    private func isLikelyFinancialSMS(sender: String, body: String) -> Bool {
        let uppercaseSender = sender.uppercased()
        let lowercaseBody = body.lowercased()

        // Check sender pattern: Indian bank SMS senders are 2-letter prefix + dash + code
        // e.g., VM-HDFCBK, AD-ICICIB, JD-SBIINB, BZ-AXISBK
        let senderPattern = #"^[A-Z]{2}-[A-Z]{4,8}$"#
        let isBankSender = uppercaseSender.range(of: senderPattern, options: .regularExpression) != nil

        // Known Indian bank sender codes
        let bankCodes = [
            "HDFCBK", "ICICIB", "SBIINB", "SBIIN", "AXISBK", "KOTAKB",
            "INDUSB", "YESBK", "PNBSMS", "BOBTXN", "CANBNK", "FEDERL",
            "IDFCFB", "RBLBNK", "UNIONB", "IDBIBK", "CENTBK", "BOIBKN",
            "HDFCCC", "ICICCC", "AMEXIN", "CITIBK", "SCBANK", "DKKBNK",
            "PAYTMB", "JUPBNK", "FIBANK"
        ]
        let matchesBankCode = bankCodes.contains(where: { uppercaseSender.contains($0) })

        // Financial keywords in body
        let financialKeywords = [
            "debited", "credited", "spent", "withdrawn", "transferred",
            "payment", "purchase", "txn", "transaction", "upi",
            "imps", "neft", "rtgs", "emi", "bal", "balance",
            "a/c", "acct", "card", "inr", "rs."
        ]
        let hasFinancialKeyword = financialKeywords.contains(where: { lowercaseBody.contains($0) })

        // Amount pattern: Rs. or INR followed by digits
        let amountPattern = #"(?:rs\.?|inr)\s?[\d,]+"#
        let hasAmount = lowercaseBody.range(of: amountPattern, options: .regularExpression) != nil

        return (isBankSender || matchesBankCode) && (hasFinancialKeyword || hasAmount)
    }
}
