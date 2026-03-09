import { BANK_SENDER_CODES, INDIAN_BANK_NAMES } from "../utils/bankMappings";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  amount: number;
  type: "debit" | "credit";
  bank: string | null;
  account: string | null;
  card: string | null;
  merchant: string | null;
  channel: TransactionChannel | null;
  upiRef: string | null;
  impsRef: string | null;
  balance: number | null;
  smsDate: Date | null;
}

export type TransactionChannel =
  | "UPI"
  | "IMPS"
  | "NEFT"
  | "RTGS"
  | "POS"
  | "ATM"
  | "NETBANKING"
  | "UNKNOWN";

// ─── Regex Patterns ──────────────────────────────────────────────────────────

/** Matches amounts like: Rs.2,450.00, INR 15000, Rs 500, INR2,50,000.50 */
const AMOUNT_PATTERN =
  /(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)/gi;

/** Matches account references: A/c XX1234, Acct no 5678, Account ****9012 */
const ACCOUNT_PATTERN =
  /(?:A\/c|Acct|Account|a\/c)\s*(?:no\.?)?\s*[Xx*]*(\d{4})/i;

/** Matches card references: Card XX9012, CC ****1234, Credit Card ending 5678 */
const CARD_PATTERN =
  /(?:Card|CC|Credit Card|Debit Card)\s*(?:no\.?)?\s*(?:ending\s*)?[Xx*]*(\d{4})/i;

/** UPI reference number */
const UPI_REF_PATTERN = /UPI\s*(?:Ref|Txn|ref\.?\s*(?:no\.?)?)[\s:.]*(\d+)/i;

/** IMPS reference */
const IMPS_REF_PATTERN = /IMPS\s*(?:Ref|Txn)[\s:.]*([\w\d]+)/i;

/** Available balance */
const BALANCE_PATTERN =
  /(?:Avl\.?\s*Bal|Available\s*Bal(?:ance)?|Bal|balance\s*(?:is)?)[\s:]*(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;

/** Date patterns commonly found in Indian bank SMS */
const DATE_PATTERNS = [
  // 19-Feb-25, 19/Feb/2025
  /(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})/,
  // 19-02-25, 19/02/2025
  /(\d{1,2})[-\/](\d{2})[-\/](\d{2,4})/,
  // 2025-02-19
  /(\d{4})[-\/](\d{2})[-\/](\d{2})/,
];

/** Debit keywords — order matters, more specific first */
const DEBIT_KEYWORDS = [
  "debited",
  "spent",
  "paid",
  "withdrawn",
  "purchase",
  "deducted",
  "sent",
  "transferred",
  "payment of",
  "used at",
  "buying",
  "txn of",
  "toward",
  "debit",
  "dr",
  "charged",
];

/** Credit keywords */
const CREDIT_KEYWORDS = [
  "credited",
  "received",
  "deposited",
  "refund",
  "cashback",
  "reversed",
  "added to",
  "credit",
  "cr",
];

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse an Indian bank SMS into a structured transaction.
 *
 * Handles SMS formats from major Indian banks including:
 * - Account debit/credit notifications
 * - Credit card transaction alerts
 * - UPI transaction confirmations
 * - IMPS/NEFT/RTGS transfer alerts
 * - ATM withdrawal notifications
 * - EMI debit notifications
 *
 * @param sender - SMS sender ID (e.g., "VM-HDFCBK")
 * @param body   - SMS body text
 * @returns Parsed transaction or null if not a financial SMS
 */
export function parseIndianBankSMS(
  sender: string,
  body: string
): ParsedTransaction | null {
  const normalized = body.replace(/\s+/g, " ").trim();
  const lowerBody = normalized.toLowerCase();

  // ─── 1. Extract amount(s) ──────────────────────────────────────────────

  const amountMatches = [...normalized.matchAll(AMOUNT_PATTERN)];
  if (amountMatches.length === 0) return null;

  const amounts = amountMatches.map((m) =>
    parseFloat(m[1].replace(/,/g, ""))
  );

  // First amount is typically the transaction amount
  const txnAmount = amounts[0];
  if (txnAmount <= 0 || isNaN(txnAmount)) return null;

  // ─── 2. Determine transaction type ─────────────────────────────────────

  const isDebit = DEBIT_KEYWORDS.some((k) => lowerBody.includes(k));
  const isCredit = CREDIT_KEYWORDS.some((k) => lowerBody.includes(k));

  // If both match, use position — whichever keyword appears first wins
  let txnType: "debit" | "credit";
  if (isDebit && isCredit) {
    const debitPos = Math.min(
      ...DEBIT_KEYWORDS.map((k) => {
        const idx = lowerBody.indexOf(k);
        return idx === -1 ? Infinity : idx;
      })
    );
    const creditPos = Math.min(
      ...CREDIT_KEYWORDS.map((k) => {
        const idx = lowerBody.indexOf(k);
        return idx === -1 ? Infinity : idx;
      })
    );
    txnType = debitPos < creditPos ? "debit" : "credit";
  } else if (isDebit) {
    txnType = "debit";
  } else if (isCredit) {
    txnType = "credit";
  } else {
    // Can't determine type — not a transaction SMS
    return null;
  }

  // ─── 3. Extract details ────────────────────────────────────────────────

  const account = normalized.match(ACCOUNT_PATTERN)?.[1] ?? null;
  const card = normalized.match(CARD_PATTERN)?.[1] ?? null;
  const upiRef = normalized.match(UPI_REF_PATTERN)?.[1] ?? null;
  const impsRef = normalized.match(IMPS_REF_PATTERN)?.[1] ?? null;

  // Balance: try the explicit balance pattern, or use second amount if present
  let balance: number | null = null;
  const balanceMatch = normalized.match(BALANCE_PATTERN);
  if (balanceMatch) {
    balance = parseFloat(balanceMatch[1].replace(/,/g, ""));
  }

  const channel = detectChannel(lowerBody);
  const bank = detectBank(sender, normalized);
  const merchant = extractMerchant(normalized, channel);
  const smsDate = extractDate(normalized);

  return {
    amount: txnAmount,
    type: txnType,
    bank,
    account,
    card,
    merchant,
    channel,
    upiRef,
    impsRef,
    balance,
    smsDate,
  };
}

// ─── Channel Detection ───────────────────────────────────────────────────────

function detectChannel(body: string): TransactionChannel | null {
  if (body.includes("upi")) return "UPI";
  if (body.includes("imps")) return "IMPS";
  if (body.includes("neft")) return "NEFT";
  if (body.includes("rtgs")) return "RTGS";
  if (body.includes("pos") || body.includes("swipe") || body.includes("merchant"))
    return "POS";
  if (body.includes("atm") || body.includes("cash withdrawal")) return "ATM";
  if (body.includes("netbanking") || body.includes("net banking"))
    return "NETBANKING";
  // Credit card transactions are typically POS
  if (body.includes("credit card") || body.includes("debit card")) return "POS";
  return null;
}

// ─── Bank Detection ──────────────────────────────────────────────────────────

function detectBank(sender: string, body: string): string | null {
  const uppSender = sender.toUpperCase();

  // 1. Try sender code mapping (most reliable)
  for (const [code, name] of Object.entries(BANK_SENDER_CODES)) {
    if (uppSender.includes(code)) return name;
  }

  // 2. Fallback: check body for bank names
  const uppBody = body.toUpperCase();
  for (const bankName of INDIAN_BANK_NAMES) {
    if (uppBody.includes(bankName.toUpperCase())) return bankName;
  }

  // 3. Last resort: extract from sender pattern (XX-BANKCODE)
  const senderMatch = uppSender.match(/^[A-Z]{2}-([A-Z]{4,8})$/);
  if (senderMatch) {
    return senderMatch[1]; // Return raw code as fallback
  }

  return null;
}

// ─── Merchant Extraction ─────────────────────────────────────────────────────

function extractMerchant(
  body: string,
  channel: TransactionChannel | null
): string | null {
  // Pattern 1: "at MERCHANT on" / "at MERCHANT for" / "at MERCHANT."
  const atPattern =
    /\bat\s+([A-Za-z0-9][\w\s\-_.&']{1,40}?)(?:\s+on\s|\s+for\s|\.\s|,\s|$)/i;
  const atMatch = body.match(atPattern);
  if (atMatch) {
    const merchant = atMatch[1].trim();
    // Filter out false positives (dates, amounts, generic words)
    if (!isGenericWord(merchant)) return merchant;
  }

  // Pattern 2: "to MERCHANT from" / "to MERCHANT via"
  const toPattern =
    /(?:paid|sent|transferred)\s+(?:to\s+)?([A-Za-z0-9][\w\s\-_.@&']{1,40}?)(?:\s+from\s|\s+via\s|\s+on\s|\.\s|,\s|$)/i;
  const toMatch = body.match(toPattern);
  if (toMatch) {
    const merchant = toMatch[1].trim();
    if (!isGenericWord(merchant)) return merchant;
  }

  // Pattern 3: UPI — "VPA: merchant@bank" or merchant name before @
  const vpaPattern = /(?:VPA|to)\s*:?\s*([a-z0-9._-]+)@[a-z]+/i;
  const vpaMatch = body.match(vpaPattern);
  if (vpaMatch) {
    return vpaMatch[1].replace(/[._-]/g, " ").trim();
  }

  // Pattern 4: "Info: MERCHANT" (some banks use this format)
  const infoPattern = /Info:\s*([A-Za-z0-9][\w\s\-_.&']{1,40}?)(?:\.|$)/i;
  const infoMatch = body.match(infoPattern);
  if (infoMatch) {
    const merchant = infoMatch[1].trim();
    if (!isGenericWord(merchant)) return merchant;
  }

  return null;
}

/** Words that are false positives for merchant names */
function isGenericWord(word: string): boolean {
  const generic = [
    "rs",
    "inr",
    "the",
    "your",
    "bank",
    "account",
    "card",
    "transaction",
    "upi",
    "imps",
    "neft",
    "rtgs",
    "pos",
    "atm",
    "on",
    "for",
    "from",
    "to",
  ];
  return generic.includes(word.toLowerCase()) || word.length < 2;
}

// ─── Date Extraction ─────────────────────────────────────────────────────────

function extractDate(body: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      try {
        const dateStr = match[0];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;

        // Manual parsing for DD-Mon-YY format
        if (/[A-Za-z]/.test(match[2])) {
          const months: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
          };
          const day = parseInt(match[1]);
          const month = months[match[2].toLowerCase()];
          let year = parseInt(match[3]);
          if (year < 100) year += 2000;
          if (month !== undefined) {
            return new Date(year, month, day);
          }
        }

        // DD-MM-YY format
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        let year = parseInt(match[3]);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ─── Test helper ─────────────────────────────────────────────────────────────

/**
 * Quick test: run this file directly to test parsing against sample SMS
 *
 * ```
 * npx tsx src/services/smsParser.ts
 * ```
 */
if (require.main === module) {
  const testMessages = [
    {
      sender: "VM-HDFCBK",
      body: "INR 2,450.00 debited from A/c XX1234 on 19-Feb-25. UPI Ref: 456789012345. Avl Bal: INR 34,567.89 - HDFC Bank",
    },
    {
      sender: "AD-ICICIB",
      body: "Rs.15,000.00 credited to your A/c XX5678 on 19-Feb-25. IMPS Ref No 789012345. Available Bal: Rs 52,340.00 - ICICI Bank",
    },
    {
      sender: "BZ-ICICCC",
      body: "Thank you for using your ICICI Bank Credit Card XX9012 for Rs.899.00 at SWIGGY on 19-Feb-25.",
    },
    {
      sender: "JD-HDFCBK",
      body: "Paid Rs.250.00 to paytm-merchant@paytm from HDFC Bank A/c XX1234. UPI Ref: 567890123456",
    },
    {
      sender: "VM-AXISBK",
      body: "INR 5,500.00 withdrawn from ATM at SBI ATM CONNAUGHT PLACE from A/c XX4321 on 20-Feb-25. Avl Bal: INR 28,900.00",
    },
    {
      sender: "AD-SBIINB",
      body: "Your a/c XX7890 is debited by Rs.1,200.00 on 20Feb25 by NEFT to JOHN DOE Ref No N123456789. Avl Bal Rs.45,600.78 -SBI",
    },
    {
      sender: "VM-KOTAKB",
      body: "Rs 3,499.00 spent on Kotak Debit Card XX6543 at AMAZON on 21-Feb-2025. Avl Bal: Rs 12,345.67. Not you? Call 1860 266 2666",
    },
    {
      sender: "JD-IDFCFB",
      body: "EMI of Rs.8,333.00 debited from your IDFC FIRST Bank A/c XX2468 on 22-Feb-25. Avl Bal: Rs.67,890.12",
    },
  ];

  console.log("Testing Indian Bank SMS Parser\n");
  console.log("=".repeat(60));

  for (const msg of testMessages) {
    const result = parseIndianBankSMS(msg.sender, msg.body);
    console.log(`\nSender: ${msg.sender}`);
    console.log(`SMS: ${msg.body.substring(0, 80)}...`);
    if (result) {
      console.log(`✅ Parsed:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Could not parse`);
    }
    console.log("-".repeat(60));
  }
}
