import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { fetchMyWallets, type Wallet } from "@/server/services/walletService";
import { listMyTransactions, type Transaction } from "@/server/services/transactionService";
import { useRates } from "@/contexts/RatesContext";
import { CURRENCIES, CURRENCY_SYMBOL, formatMoney, getRate, type Currency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, Send, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/dashboard")({
  component: () => (<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>),
});

function Dashboard() {
  const { user } = useAuth();
  const { rates, updatedAt } = useRates();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchMyWallets().then(setWallets).catch(() => {});
    listMyTransactions().then((t) => setTxns(t.slice(0, 6))).catch(() => {});
  }, []);

  const totalUsd = wallets.reduce((s, w) => s + w.balance / rates[w.currency], 0);

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 text-primary-foreground shadow-[var(--shadow-elegant)]"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="text-sm opacity-80">Total balance (USD equivalent)</div>
        <div className="mt-1 text-4xl font-bold">{formatMoney(totalUsd, "USD")}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/send"><Button className="bg-white text-primary hover:bg-white/90"><Send className="mr-1.5 h-4 w-4" />Send</Button></Link>
          <Link to="/deposit"><Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10"><ArrowDownToLine className="mr-1.5 h-4 w-4" />Deposit</Button></Link>
          <Link to="/withdraw"><Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10"><ArrowUpFromLine className="mr-1.5 h-4 w-4" />Withdraw</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CURRENCIES.map((c) => {
          const w = wallets.find((x) => x.currency === c);
          const bal = w?.balance ?? 0;
          return (
            <Card key={c}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c}</span>
                  <span className="text-lg">{CURRENCY_SYMBOL[c]}</span>
                </div>
                <div className="mt-2 text-2xl font-bold">{formatMoney(bal, c)}</div>
                <div className="mt-1 text-xs text-muted-foreground">≈ {formatMoney(bal / rates[c], "USD")}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent transactions</CardTitle></CardHeader>
          <CardContent>
            {txns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {txns.map((t) => {
                  const isOut = t.sender_id === user?.id && t.type !== "DEPOSIT";
                  return (
                    <li key={t.id}>
                      <Link to="/transaction/$id" params={{ id: t.id }} className="flex items-center justify-between py-3 hover:bg-secondary/40 px-2 rounded-md">
                        <div>
                          <div className="text-sm font-medium">{t.type}{t.original_currency !== t.converted_currency ? ` · ${t.original_currency} → ${t.converted_currency}` : ""}</div>
                          <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                        </div>
                        <div className={`text-sm font-semibold ${isOut ? "text-destructive" : "text-success"}`}>
                          {isOut ? "-" : "+"}{formatMoney(isOut ? t.original_amount : t.converted_amount, isOut ? t.original_currency : t.converted_currency)}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Live exchange rates
            </CardTitle>
            <p className="text-xs text-muted-foreground">Updated {updatedAt.toLocaleTimeString()}</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(["INR","EUR","GBP"] as Currency[]).map((c) => (
                <li key={c} className="flex justify-between">
                  <span className="text-muted-foreground">1 USD →</span>
                  <span className="font-medium">{getRate("USD", c, rates).toFixed(4)} {c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}