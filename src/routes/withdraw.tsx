import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PinInput } from "@/components/PinInput";
import { CURRENCIES, formatMoney, type Currency } from "@/lib/currency";
import { processTransaction } from "@/server/services/transactionService";
import { fetchMyWallets, type Wallet } from "@/server/services/walletService";
import { toast } from "sonner";
import { ArrowUpFromLine, Loader2 } from "lucide-react";

export const Route = createFileRoute("/withdraw")({
  component: () => (<RequireAuth><AppShell><Withdraw /></AppShell></RequireAuth>),
});

function Withdraw() {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchMyWallets().then(setWallets).catch(() => {}); }, []);
  const wallet = wallets.find((w) => w.currency === currency);

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (!wallet || wallet.balance < n) return toast.error("Insufficient balance");
    if (pin.length !== 4) return toast.error("Enter your PIN");
    setBusy(true);
    try {
      const txn = await processTransaction({
        idempotencyKey: crypto.randomUUID(),
        type: "WITHDRAW",
        pin,
        amount: n,
        currency,
        exchangeRate: 1,
      });
      toast.success("Withdrawal successful");
      navigate({ to: "/transaction/$id", params: { id: txn.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-5 w-5" /> Withdraw funds</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Simulated withdrawal to an external bank account.</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              {wallet && <p className="text-xs text-muted-foreground">Available: {formatMoney(wallet.balance, currency)}</p>}
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
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Withdraw
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}