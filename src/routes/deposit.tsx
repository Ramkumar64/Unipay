import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PinInput } from "@/components/PinInput";
import { CURRENCIES, type Currency } from "@/lib/currency";
import { processTransaction } from "@/server/services/transactionService";
import { toast } from "sonner";
import { ArrowDownToLine, Loader2 } from "lucide-react";

export const Route = createFileRoute("/deposit")({
  component: () => (<RequireAuth><AppShell><Deposit /></AppShell></RequireAuth>),
});

function Deposit() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (pin.length !== 4) return toast.error("Enter your PIN");
    setBusy(true);
    try {
      const txn = await processTransaction({
        idempotencyKey: crypto.randomUUID(),
        type: "DEPOSIT",
        pin,
        amount: n,
        currency,
        exchangeRate: 1,
      });
      toast.success("Deposit successful");
      navigate({ to: "/transaction/$id", params: { id: txn.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Deposit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" /> Deposit funds</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Simulated bank deposit. Funds are added instantly to your wallet.</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Transaction PIN</Label>
            <PinInput value={pin} onChange={setPin} />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Deposit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}