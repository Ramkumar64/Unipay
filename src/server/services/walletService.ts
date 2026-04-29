import { supabase } from "@/integrations/supabase/client";
import type { Currency } from "@/lib/currency";

export interface Wallet {
  id: string;
  user_id: string;
  currency: Currency;
  balance: number;
}

export async function fetchMyWallets(): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from("wallets")
    .select("id, user_id, currency, balance")
    .order("currency");
  if (error) throw error;
  return (data ?? []).map((w) => ({ ...w, balance: Number(w.balance) })) as Wallet[];
}