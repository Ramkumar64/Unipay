import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTransaction, type Transaction } from "@/server/services/transactionService";
import { formatMoney } from "@/lib/currency";
import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/transaction/$id")({
  component: () => (<RequireAuth><AppShell><TxnDetail /></AppShell></RequireAuth>),
});

function TxnDetail() {
  const { id } = Route.useParams();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTransaction(id).then(setTxn).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!txn) return (
    <div className="text-center">
      <p className="text-muted-foreground">Transaction not found.</p>
      <Link to="/history"><Button variant="link">Back to history</Button></Link>
    </div>
  );

  const Icon = txn.status === "SUCCESS" ? CheckCircle2 : txn.status === "FAILED" ? XCircle : Clock;
  const tone = txn.status === "SUCCESS" ? "text-success" : txn.status === "FAILED" ? "text-destructive" : "text-warning";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Icon className={`h-8 w-8 ${tone}`} />
            <div>
              <CardTitle className="text-lg">{txn.type} · {formatMoney(txn.original_amount, txn.original_currency)}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={txn.status === "SUCCESS" ? "default" : txn.status === "FAILED" ? "destructive" : "secondary"}>
                  {txn.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{new Date(txn.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Type" value={txn.type} />
          <Row label="Original amount" value={formatMoney(txn.original_amount, txn.original_currency)} />
          <Row label="Converted amount" value={formatMoney(txn.converted_amount, txn.converted_currency)} />
          <Row label="Exchange rate" value={`1 ${txn.original_currency} = ${txn.exchange_rate.toFixed(4)} ${txn.converted_currency}`} />
          <Row label="Idempotency key" value={txn.idempotency_key} mono />
          <Row label="Transaction ID" value={txn.id} mono />
          {txn.failure_reason && <Row label="Failure reason" value={txn.failure_reason} danger />}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono, danger }: { label: string; value: string; mono?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${danger ? "text-destructive" : ""} text-right break-all`}>{value}</span>
    </div>
  );
}