import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listMyTransactions, type Transaction } from "@/server/services/transactionService";
import { formatMoney } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: () => (<RequireAuth><AppShell><HistoryPage /></AppShell></RequireAuth>),
});

function HistoryPage() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");

  useEffect(() => { listMyTransactions().then(setTxns).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (type !== "ALL" && t.type !== type) return false;
      if (status !== "ALL" && t.status !== status) return false;
      if (q && !JSON.stringify(t).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [txns, q, type, status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HistoryIcon className="h-5 w-5" /> Transaction history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="SEND">Send</SelectItem>
              <SelectItem value="DEPOSIT">Deposit</SelectItem>
              <SelectItem value="WITHDRAW">Withdraw</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No transactions.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t) => {
              const isOut = t.sender_id === user?.id && t.type !== "DEPOSIT";
              return (
                <li key={t.id}>
                  <Link to="/transaction/$id" params={{ id: t.id }} className="flex items-center justify-between gap-4 py-3 px-2 rounded-md hover:bg-secondary/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {t.type}
                        <Badge variant={t.status === "SUCCESS" ? "default" : t.status === "FAILED" ? "destructive" : "secondary"}>{t.status}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div className={"text-sm font-semibold " + (isOut ? "text-destructive" : "text-success")}>
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
  );
}