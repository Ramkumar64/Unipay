import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PinInput } from "@/components/PinInput";
import { fetchMyWallets, type Wallet } from "@/server/services/walletService";
import {
  lookupUserByEmail,
  processTransaction,
} from "@/server/services/transactionService";
import { useRates } from "@/contexts/RatesContext";
import { CURRENCIES, formatMoney, getRate, type Currency } from "@/lib/currency";
import { toast } from "sonner";
import { ArrowRight, Loader2, Send as SendIcon, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/send")({
  component: () => (<RequireAuth><AppShell><SendFlow /></AppShell></RequireAuth>),
});

type Step = 1 | 2 | 3;

function SendFlow() {
  const { rates } = useRates();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [step, setStep] = useState<Step>(1);

  const [recipient, setRecipient] = useState("");
  const [recipientInfo, setRecipientInfo] = useState<{ id: string; email: string; full_name: string | null; preferred_currency: Currency } | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [lockedRate, setLockedRate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchMyWallets().then(setWallets).catch(() => {}); }, []);
  const wallet = wallets.find((w) => w.currency === currency);

  const toCurrency: Currency = recipientInfo?.preferred_currency ?? currency;
  const liveRate = getRate(currency, toCurrency, rates);
  const effectiveRate = lockedRate ?? liveRate;
  const amountNum = Number(amount) || 0;
  const converted = useMemo(() => +(amountNum * effectiveRate).toFixed(2), [amountNum, effectiveRate]);

  const lookup = async () => {
    if (!recipient) return;
    try {
      const r = await lookupUserByEmail(recipient);
      if (!r) throw new Error("Recipient not found");
      setRecipientInfo(r);
      toast.success(`Recipient: ${r.full_name ?? r.email}`);
    } catch (e: any) {
      setRecipientInfo(null);
      toast.error(e.message ?? "Recipient not found");
    }
  };

  const toConfirm = () => {
    if (!recipientInfo) return toast.error("Look up the recipient first");
    if (amountNum <= 0) return toast.error("Enter a valid amount");
    if (!wallet || wallet.balance < amountNum) return toast.error("Insufficient balance");
    setLockedRate(liveRate);
    setStep(2);
  };

  const submit = async () => {
    if (!recipientInfo || !lockedRate) return;
    if (pin.length !== 4) return toast.error("Enter your 4-digit PIN");
    setBusy(true);
    try {
      const txn = await processTransaction({
        idempotencyKey,
        type: "SEND",
        pin,
        amount: amountNum,
        currency,
        exchangeRate: lockedRate,
        receiverEmail: recipientInfo.email,
      });
      toast.success("Payment sent");
      navigate({ to: "/transaction/$id", params: { id: txn.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Transaction failed");
      setIdempotencyKey(crypto.randomUUID());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <StepPill n={1} active={step >= 1} label="Details" />
        <ArrowRight className="h-3 w-3" />
        <StepPill n={2} active={step >= 2} label="Review" />
        <ArrowRight className="h-3 w-3" />
        <StepPill n={3} active={step >= 3} label="PIN" />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><SendIcon className="h-5 w-5" /> Send money</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Recipient email</Label>
              <div className="flex gap-2">
                <Input value={recipient} onChange={(e) => { setRecipient(e.target.value); setRecipientInfo(null); }} placeholder="bob@demo.com" />
                <Button type="button" variant="secondary" onClick={lookup}>Lookup</Button>
              </div>
              {recipientInfo && (
                <p className="text-xs text-success">✓ {recipientInfo.full_name ?? recipientInfo.email} · receives in {recipientInfo.preferred_currency}</p>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                {wallet && <p className="text-xs text-muted-foreground">Balance: {formatMoney(wallet.balance, currency)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {recipientInfo && amountNum > 0 && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>1 {currency} = {liveRate.toFixed(4)} {toCurrency}</span></div>
                <div className="mt-1 flex justify-between font-medium"><span>Recipient gets</span><span>{formatMoney(amountNum * liveRate, toCurrency)}</span></div>
              </div>
            )}
            <Button className="w-full" onClick={toConfirm}>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && recipientInfo && (
        <Card>
          <CardHeader><CardTitle>Review transfer</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="To" value={`${recipientInfo.full_name ?? recipientInfo.email} (${recipientInfo.email})`} />
            <Row label="You send" value={formatMoney(amountNum, currency)} />
            <Row label="Exchange rate (locked)" value={`1 ${currency} = ${effectiveRate.toFixed(4)} ${toCurrency}`} />
            <Row label="They receive" value={formatMoney(converted, toCurrency)} bold />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>Confirm & enter PIN</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Enter PIN</CardTitle>
            <p className="text-sm text-muted-foreground">Enter your 4-digit transaction PIN to authorize this payment.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <PinInput value={pin} onChange={setPin} autoFocus />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={busy}>Back</Button>
              <Button className="flex-1" onClick={submit} disabled={busy || pin.length !== 4}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay {formatMoney(amountNum, currency)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function StepPill({ n, active, label }: { n: number; active: boolean; label: string }) {
  return (
    <div className={"flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium " + (active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">{n}</span>{label}
    </div>
  );
}