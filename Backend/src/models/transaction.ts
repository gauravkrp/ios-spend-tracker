import { PrismaClient, Prisma } from "@prisma/client";
import type { ParsedTransaction } from "../services/smsParser";

const prisma = new PrismaClient();

export { prisma };

// ─── Create Transaction ──────────────────────────────────────────────────────

export async function createTransaction(
  parsed: ParsedTransaction,
  sender: string,
  rawMessage: string
) {
  try {
    return await prisma.transaction.create({
      data: {
        amount: parsed.amount,
        type: parsed.type,
        bank: parsed.bank,
        account: parsed.account,
        card: parsed.card,
        merchant: parsed.merchant,
        channel: parsed.channel,
        upiRef: parsed.upiRef,
        impsRef: parsed.impsRef,
        balance: parsed.balance,
        sender,
        rawMessage,
        smsDate: parsed.smsDate,
      },
    });
  } catch (err) {
    // Unique constraint violation = duplicate SMS, ignore
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      console.log("Duplicate SMS ignored:", rawMessage.substring(0, 50));
      return null;
    }
    throw err;
  }
}

// ─── Query Transactions ──────────────────────────────────────────────────────

export interface TransactionQuery {
  type?: "debit" | "credit";
  bank?: string;
  channel?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getTransactions(query: TransactionQuery) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 50, 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.TransactionWhereInput = {};

  if (query.type) where.type = query.type;
  if (query.bank) where.bank = { contains: query.bank, mode: "insensitive" };
  if (query.channel) where.channel = query.channel;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = query.from;
    if (query.to) where.createdAt.lte = query.to;
  }
  if (query.minAmount || query.maxAmount) {
    where.amount = {};
    if (query.minAmount) where.amount.gte = query.minAmount;
    if (query.maxAmount) where.amount.lte = query.maxAmount;
  }
  if (query.search) {
    where.OR = [
      { merchant: { contains: query.search, mode: "insensitive" } },
      { bank: { contains: query.search, mode: "insensitive" } },
      { rawMessage: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page, pageSize };
}

// ─── Spending Summary ────────────────────────────────────────────────────────

export async function getSpendingSummary(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const transactions = await prisma.transaction.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const totalSpent = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalReceived = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  // By bank
  const bankMap = new Map<
    string,
    { spent: number; received: number; count: number }
  >();
  for (const t of transactions) {
    const bank = t.bank ?? "Unknown";
    const existing = bankMap.get(bank) ?? { spent: 0, received: 0, count: 0 };
    if (t.type === "debit") existing.spent += t.amount;
    else existing.received += t.amount;
    existing.count++;
    bankMap.set(bank, existing);
  }

  // By account (bank + account/card)
  const accountMap = new Map<
    string,
    { bank: string; account: string; spent: number; received: number; count: number; lastTransactionAt: string }
  >();
  for (const t of transactions) {
    const bank = t.bank ?? "Unknown";
    const acctNum = t.card ?? t.account ?? "N/A";
    const label = acctNum !== "N/A" ? `${bank} ••${acctNum}` : bank;
    const existing = accountMap.get(label) ?? {
      bank,
      account: acctNum,
      spent: 0,
      received: 0,
      count: 0,
      lastTransactionAt: t.createdAt.toISOString(),
    };
    if (t.type === "debit") existing.spent += t.amount;
    else existing.received += t.amount;
    existing.count++;
    if (t.createdAt.toISOString() > existing.lastTransactionAt) {
      existing.lastTransactionAt = t.createdAt.toISOString();
    }
    accountMap.set(label, existing);
  }

  // By channel
  const channelMap = new Map<string, { amount: number; count: number }>();
  for (const t of transactions) {
    const ch = t.channel ?? "UNKNOWN";
    const existing = channelMap.get(ch) ?? { amount: 0, count: 0 };
    existing.amount += t.amount;
    existing.count++;
    channelMap.set(ch, existing);
  }

  // By day
  const dayMap = new Map<string, { spent: number; received: number }>();
  for (const t of transactions) {
    const dateKey = t.createdAt.toISOString().split("T")[0];
    const existing = dayMap.get(dateKey) ?? { spent: 0, received: 0 };
    if (t.type === "debit") existing.spent += t.amount;
    else existing.received += t.amount;
    dayMap.set(dateKey, existing);
  }

  return {
    totalSpent,
    totalReceived,
    transactionCount: transactions.length,
    byBank: Array.from(bankMap.entries()).map(([bank, data]) => ({
      bank,
      ...data,
    })),
    byAccount: Array.from(accountMap.entries()).map(([label, data]) => ({
      label,
      ...data,
    })),
    byChannel: Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      ...data,
    })),
    byDay: Array.from(dayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteTransaction(id: string) {
  return prisma.transaction.delete({ where: { id } });
}
