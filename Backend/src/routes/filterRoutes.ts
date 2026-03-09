import { Router } from "express";
import { parseIndianBankSMS } from "../services/smsParser";
import { createTransaction } from "../models/transaction";

const router = Router();

/**
 * POST /api/filter-sms
 *
 * This is the endpoint that Apple's ILMessageFilterExtension network
 * deferred action calls. When the extension returns `.needsNetworkAction`,
 * iOS sends the SMS content to this URL.
 *
 * Apple's request format:
 * {
 *   "_version": 1,
 *   "query": {
 *     "sender": "VM-HDFCBK",
 *     "message": {
 *       "text": "INR 2,450.00 debited from A/c XX1234..."
 *     }
 *   }
 * }
 *
 * Expected response format:
 * {
 *   "action": 0  // 0=none, 1=allow, 2=junk, 3=promotion, 4=transaction
 * }
 *
 * Action values (ILMessageFilterAction):
 *   0 = none (no classification)
 *   1 = allow
 *   2 = junk (with sub-actions available)
 *   3 = promotion (iOS 16+)
 *   4 = transaction (iOS 16+)
 */
router.post("/filter-sms", async (req, res) => {
  try {
    const body = req.body;

    // Apple's ILMessageFilterExtension sends:
    // { "_sf": "VM-HDFCBK", "_smb": "INR 2,450.00 debited..." }
    // Also support the documented query format as fallback
    const sender: string =
      body?._sf ?? body?.query?.sender ?? body?.sender ?? "";
    const messageText: string =
      body?._smb ?? body?.query?.message?.text ?? body?.message ?? "";

    console.log(`[SMS Filter] Raw body keys: ${Object.keys(body || {}).join(", ")}`);

    if (!sender || !messageText) {
      console.log(`[SMS Filter] Missing sender or message, allowing through`);
      return res.json({ action: 0 });
    }

    console.log(`[SMS Filter] Sender: ${sender}`);
    console.log(`[SMS Filter] Message: ${messageText.substring(0, 80)}...`);

    // Parse the SMS
    const parsed = parseIndianBankSMS(sender, messageText);

    if (parsed) {
      // It's a financial transaction SMS — store it
      const txn = await createTransaction(parsed, sender, messageText);

      if (txn) {
        console.log(
          `[SMS Filter] ✅ Transaction stored: ${parsed.type} ₹${parsed.amount} ${parsed.bank ?? ""} ${parsed.merchant ?? ""}`
        );
      }

      // Classify as "transaction" (iOS 16+) or "allow"
      // Action 4 = transaction (puts it in Transactions folder in Messages)
      // Action 0 = none (keeps it in main inbox)
      return res.json({
        action: 4, // transaction sub-folder
        // For iOS < 16, use action: 0 (none/allow)
      });
    }

    // Not a financial SMS — check if it's promotional
    const isPromo = isPromotionalSMS(messageText);
    if (isPromo) {
      return res.json({ action: 3 }); // promotion
    }

    // Unknown / not relevant — let through
    return res.json({ action: 0 });
  } catch (error) {
    console.error("[SMS Filter] Error:", error);
    // On error, allow the message through
    return res.json({ action: 0 });
  }
});

/**
 * Basic promotional SMS detection for Indian SMS.
 * These are typically marketing messages from banks/companies.
 */
function isPromotionalSMS(body: string): boolean {
  const lowerBody = body.toLowerCase();
  const promoKeywords = [
    "offer",
    "discount",
    "cashback offer",
    "apply now",
    "pre-approved",
    "upgrade",
    "exclusive",
    "limited period",
    "sale",
    "reward points",
    "earn",
    "subscribe",
    "opt out",
    "unsubscribe",
    "t&c apply",
  ];
  const matchCount = promoKeywords.filter((k) => lowerBody.includes(k)).length;
  return matchCount >= 2;
}

export default router;
