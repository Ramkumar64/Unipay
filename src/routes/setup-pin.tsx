import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { PinInput } from "@/components/PinInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setUserPin } from "@/server/services/transactionService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/setup-pin")({
  component: () => (<RequireAuth><SetupPin /></RequireAuth>),
});

function SetupPin() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{4}$/.test(pin)) return toast.error("PIN must be 4 digits");
    if (pin !== confirm) return toast.error("PINs don't match");
    setBusy(true);
    try {
      await setUserPin(pin);
      await refreshProfile();
      toast.success("PIN set successfully");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to set PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>Set your transaction PIN</CardTitle>
          <p className="text-sm text-muted-foreground">A 4-digit PIN is required for every payment. Think of it as your UPI PIN.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Choose PIN</div>
            <PinInput value={pin} onChange={setPin} autoFocus />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Confirm PIN</div>
            <PinInput value={confirm} onChange={setConfirm} />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy || pin.length !== 4 || confirm.length !== 4}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save PIN
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}