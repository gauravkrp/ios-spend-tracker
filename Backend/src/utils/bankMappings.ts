/**
 * Mapping of Indian bank SMS sender codes to bank names.
 *
 * Indian transactional SMS senders follow the pattern:
 *   PREFIX-CODE (e.g., VM-HDFCBK, AD-ICICIB, JD-SBIINB)
 *
 * The PREFIX (2 chars) indicates the telecom circle.
 * The CODE (4-8 chars) identifies the bank/entity.
 *
 * This mapping covers major Indian banks, credit card issuers,
 * digital banks, and payment platforms.
 */

export const BANK_SENDER_CODES: Record<string, string> = {
  // Major Private Banks
  HDFCBK: "HDFC Bank",
  HDFCBN: "HDFC Bank",
  HDFCCC: "HDFC Bank (Card)",
  ICICIB: "ICICI Bank",
  ICICBC: "ICICI Bank",
  ICICCC: "ICICI Bank (Card)",
  AXISBK: "Axis Bank",
  AXISCC: "Axis Bank (Card)",
  KOTAKB: "Kotak Mahindra Bank",
  KOTKCC: "Kotak Mahindra Bank (Card)",
  INDUSB: "IndusInd Bank",
  YESBK: "Yes Bank",
  IDFCFB: "IDFC FIRST Bank",
  FEDERL: "Federal Bank",
  RBLBNK: "RBL Bank",
  RBLCRD: "RBL Bank (Card)",

  // Public Sector Banks
  SBIINB: "SBI",
  SBIIN: "SBI",
  SBICRD: "SBI (Card)",
  SBMSMS: "SBI",
  PNBSMS: "PNB",
  BOBTXN: "Bank of Baroda",
  BOBSMS: "Bank of Baroda",
  CANBNK: "Canara Bank",
  UNIONB: "Union Bank",
  IDBIBK: "IDBI Bank",
  CENTBK: "Central Bank",
  BOIBKN: "Bank of India",
  IOBSMS: "Indian Overseas Bank",
  UCOBKN: "UCO Bank",
  BNKBRD: "Bank of Baroda",

  // Foreign Banks
  CITIBK: "Citibank",
  SCBANK: "Standard Chartered",
  HSBCBK: "HSBC",
  DKKBNK: "Deutsche Bank",
  AMEXIN: "American Express",

  // Digital / Neo Banks
  PAYTMB: "Paytm Payments Bank",
  JUPBNK: "Jupiter",
  FIBANK: "Fi Money",
  SLICEP: "Slice",
  NIOBKN: "Niyo",

  // Payment Platforms (also send transaction SMS)
  PYTM: "Paytm",
  PHONPE: "PhonePe",
  GPAY: "Google Pay",
  AMAZONP: "Amazon Pay",
  CRED: "CRED",
};

/**
 * Known Indian bank names for fallback detection in SMS body.
 */
export const INDIAN_BANK_NAMES = [
  "HDFC Bank",
  "ICICI Bank",
  "SBI",
  "State Bank",
  "Axis Bank",
  "Kotak",
  "IndusInd",
  "Yes Bank",
  "PNB",
  "Punjab National",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank",
  "IDBI",
  "IDFC FIRST",
  "Federal Bank",
  "RBL Bank",
  "Central Bank",
  "Bank of India",
  "IOB",
  "UCO Bank",
  "Citibank",
  "Standard Chartered",
  "HSBC",
  "American Express",
  "Amex",
  "Paytm",
  "Jupiter",
  "Fi Money",
  "Slice",
] as const;
