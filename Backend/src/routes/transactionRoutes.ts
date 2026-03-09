import { Router } from "express";
import {
  getTransactions,
  getSpendingSummary,
  deleteTransaction,
} from "../models/transaction";

const router = Router();

/**
 * GET /api/transactions
 *
 * Fetch transactions with optional filters.
 *
 * Query params:
 *   type      - "debit" | "credit"
 *   bank      - bank name (partial match)
 *   channel   - UPI, IMPS, NEFT, RTGS, POS, ATM, NETBANKING
 *   from      - ISO date string (start date)
 *   to        - ISO date string (end date)
 *   minAmount - minimum amount
 *   maxAmount - maximum amount
 *   q         - search query (matches merchant, bank, raw message)
 *   page      - page number (default: 1)
 *   pageSize  - items per page (default: 50, max: 100)
 */
router.get("/", async (req, res) => {
  try {
    const query = {
      type: req.query.type as "debit" | "credit" | undefined,
      bank: req.query.bank as string | undefined,
      channel: req.query.channel as string | undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      minAmount: req.query.minAmount
        ? parseFloat(req.query.minAmount as string)
        : undefined,
      maxAmount: req.query.maxAmount
        ? parseFloat(req.query.maxAmount as string)
        : undefined,
      search: req.query.q as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 50,
    };

    const result = await getTransactions(query);
    return res.json(result);
  } catch (error) {
    console.error("[Transactions] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/transactions/summary
 *
 * Get spending summary for the dashboard.
 *
 * Query params:
 *   days - number of days to look back (default: 30)
 */
router.get("/summary", async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const summary = await getSpendingSummary(days);
    return res.json(summary);
  } catch (error) {
    console.error("[Summary] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/transactions/:id
 *
 * Delete a transaction (e.g., false positive).
 */
router.delete("/:id", async (req, res) => {
  try {
    await deleteTransaction(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error("[Delete] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
