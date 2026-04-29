import { supabase } from "@/integrations/supabase/client";
import type { Currency } from "@/lib/currency";

export type TxnType = "SEND" | "DEPOSIT" | "WITHDRAW";
export type TxnStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface Transaction {
  id: string;
  idempotency_key: string;
  sender_id: string | null;
  receiver_id: string | null;
  type: TxnType;
  original_amount: number;
  original_currency: Currency;
  converted_amount: number;
  converted_currency: Currency;
  exchange_rate: number;
  status: TxnStatus;
  failure_reason: string | null;
  created_at: string;
}

export interface ProcessTransactionInput {
  idempotencyKey: string;
  type: TxnType;
  pin: string;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  receiverEmail?: string;
}

function normalize(row: any): Transaction {
  return {
    ...row,
    original_amount: Number(row.original_amount),
    converted_amount: Number(row.converted_amount),
    exchange_rate: Number(row.exchange_rate),
  } as Transaction;
}

export async function processTransaction(input: ProcessTransactionInput): Promise<Transaction> {
  const { data, error } = await supabase.rpc("process_transaction", {
    p_idempotency_key: input.idempotencyKey,
    p_type: input.type,
    p_pin: input.pin,
    p_original_amount: input.amount,
    p_original_currency: input.currency,
    p_exchange_rate: input.exchangeRate,
    p_receiver_email: input.receiverEmail ?? undefined,
  });
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function listMyTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function setUserPin(pin: string): Promise<void> {
  const { error } = await supabase.rpc("set_user_pin", { p_pin: pin });
  if (error) throw new Error(error.message);
}

export interface ProfileLite {
  id: string;
  email: string;
  full_name: string | null;
  preferred_currency: Currency;
  pin_hash: string | null;
}

export async function fetchMyProfile(userId: string): Promise<ProfileLite | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, preferred_currency, pin_hash")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileLite) ?? null;
}

export async function lookupUserByEmail(email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, preferred_currency")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; email: string; full_name: string | null; preferred_currency: Currency } | null;
}