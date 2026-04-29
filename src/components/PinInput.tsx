import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  length?: number;
}

export function PinInput({ value, onChange, autoFocus, length = 4 }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
  const setDigit = (i: number, d: string) => {
    const clean = d.replace(/\D/g, "").slice(0, 1);
    const arr = value.padEnd(length, " ").split("");
    arr[i] = clean || " ";
    onChange(arr.join("").trimEnd());
    if (clean && i < length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus(); }}
          type="password"
          className="h-14 w-12 rounded-lg border border-input bg-card text-center text-2xl font-bold outline-none ring-ring focus:ring-2"
        />
      ))}
    </div>
  );
}