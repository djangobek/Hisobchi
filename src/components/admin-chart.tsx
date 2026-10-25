"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUZS } from "@/lib/currency";

const short = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}mlrd` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}mln` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

export default function AdminChart({ data }: { data: { day: string; income: number; expense: number }[] }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.45} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
            <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.2)" />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} tickLine={false} />
          <YAxis tickFormatter={short} fontSize={11} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={(v: number, n: string) => [formatUZS(v), n === "income" ? "Tushum" : "Xarajat"]} />
          <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gi)" strokeWidth={2} />
          <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#ge)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
