import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe2, Lock, Send, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div
        className="relative overflow-hidden text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <Wallet className="h-5 w-5" /> CrossBorderX
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Send money across borders, instantly.
          </h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">
            A multi-currency smart wallet with bank-grade safety. USD, INR, EUR & GBP.
            Atomic transactions. Full audit trail. Built like real fintech.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Try a demo account
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
        {[
          { Icon: Globe2, title: "Multi-currency", body: "Hold and convert USD, INR, EUR and GBP with live rates." },
          { Icon: Lock, title: "PIN protected", body: "Every transfer needs your 4-digit UPI PIN. Lockout after 5 fails." },
          { Icon: Send, title: "Atomic & audited", body: "Server-side RPC with row locks, idempotency keys, and a full ledger." },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
