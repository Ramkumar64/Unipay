import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyTransactions, type Transaction } from "@/server/services/transactionService";
import { formatMoney } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  component: () => (<RequireAuth><AppShell><Analytics /></AppShell></RequireAuth>),
});

function Analytics() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  useEffect(() => { listMyTransactions().then(setTxns).catch(() => {}); }, []);

  const stats = useMemo(() => {
    const sent = txns.filter((t) => t.sender_id === user?.id && t.type === "SEND" && t.status === "SUCCESS");
    const received = txns.filter((t) => t.receiver_id === user?.id && t.type === "SEND" && t.status === "SUCCESS");
    const deposits = txns.filter((t) => t.type === "DEPOSIT" && t.status === "SUCCESS");
    const withdrawals = txns.filter((t) => t.type === "WITHDRAW" && t.status === "SUCCESS");
    const failed = txns.filter((t) => t.status === "FAILED").length;
    const sumUsd = (list: Transaction[], side: "out" | "in") =>
      list.reduce((s, t) => {
        const amt = side === "out" ? t.original_amount : t.converted_amount;
        const cur = side === "out" ? t.original_currency : t.converted_currency;
        const usd = cur === "USD" ? amt : amt / (t.exchange_rate || 1);
        return s + usd;
      }, 0);
    return {
      sentCount: sent.length,
      sentUsd: sumUsd(sent, "out"),
      receivedCount: received.length,
      receivedUsd: sumUsd(received, "in"),
      depositCount: deposits.length,
      withdrawCount: withdrawals.length,
      failed,
      total: txns.length,
    };
  }, [txns, user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><BarChart3 className="h-5 w-5" /> Analytics</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Total transactions" value={stats.total.toString()} />
        <Stat title="Money sent" value={formatMoney(stats.sentUsd, "USD")} sub={`${stats.sentCount} transfers`} />
        <Stat title="Money received" value={formatMoney(stats.receivedUsd, "USD")} sub={`${stats.receivedCount} transfers`} />
        <Stat title="Failed" value={stats.failed.toString()} sub="all-time" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Activity breakdown</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <Bar label="Sent" count={stats.sentCount} total={stats.total} />
            <Bar label="Received" count={stats.receivedCount} total={stats.total} />
            <Bar label="Deposits" count={stats.depositCount} total={stats.total} />
            <Bar label="Withdrawals" count={stats.withdrawCount} total={stats.total} />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <li>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{count} · {pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-[image:var(--gradient-primary)]" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}