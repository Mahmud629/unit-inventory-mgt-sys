"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "@/lib/client";
import { badgeClass } from "@/lib/inventory";
import type { DashboardData } from "@/lib/types";

const CARDS: {
  key: keyof DashboardData["stats"];
  label: string;
  href: string;
  className: string;
}[] = [
  { key: "total", label: "Total Items", href: "/inventory", className: "" },
  { key: "store", label: "In Store", href: "/inventory?status=In+Store", className: "stat-store" },
  { key: "issued", label: "Issued", href: "/inventory?status=Issued", className: "stat-issued" },
  { key: "repair", label: "In Repair", href: "/inventory?status=Repair", className: "stat-repair" },
  { key: "damaged", label: "Damaged", href: "/inventory?status=Damaged", className: "stat-damaged" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [holderSearch, setHolderSearch] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(errorText(err)));
  }, []);

  const issued = useMemo(() => {
    const q = holderSearch.toLowerCase().trim();
    const rows = data?.issued || [];
    if (!q) return rows;
    return rows.filter((r) => `${r.holder} ${r.itemName} ${r.inventoryNo}`.toLowerCase().includes(q));
  }, [data, holderSearch]);

  const holderCount = new Set((data?.issued || []).map((r) => r.holder)).size;
  const openItem = (id: string) => router.push(`/inventory?item=${id}`);
  const placeholder = error || (data ? null : "Loading…");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>
            Unit property at a glance
            {data ? ` — ${data.stats.lines} item line${data.stats.lines === 1 ? "" : "s"}` : ""}.
          </p>
        </div>
        <div className="btn-group">
          <Link className="btn btn-ghost" href="/inventory">
            Open Register
          </Link>
          <Link className="btn" href="/inventory?new=1">
            + Add Item
          </Link>
        </div>
      </div>

      <div className="stats">
        {CARDS.map((card) => (
          <Link key={card.key} href={card.href} className={`stat ${card.className}`}>
            <span>{card.label}</span>
            <b>{data ? data.stats[card.key] : "–"}</b>
            <small>View items →</small>
          </Link>
        ))}
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Who Holds What</h3>
              <p>
                {data ? `${holderCount} holder${holderCount === 1 ? "" : "s"} with issued items` : "Issued items by holder"}
              </p>
            </div>
            <input
              className="input"
              style={{ maxWidth: 220 }}
              type="search"
              placeholder="Find holder or item"
              value={holderSearch}
              onChange={(e) => setHolderSearch(e.target.value)}
              aria-label="Find holder or item"
            />
          </div>
          <div className="table-wrap" style={{ maxHeight: 440, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Holder</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((r) => (
                  <tr key={`${r.holder}-${r.itemId}`} className="clickable" onClick={() => openItem(r.itemId)}>
                    <td style={{ fontWeight: 700 }}>{r.holder}</td>
                    <td>
                      {r.itemName} <span className="muted nowrap">({r.inventoryNo})</span>
                    </td>
                    <td className="num">{r.qty}</td>
                    <td className="nowrap">{r.since}</td>
                  </tr>
                ))}
                {issued.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      {placeholder || (holderSearch ? "No match." : "Nothing is issued right now — everything is in store.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Recent Activity</h3>
              <p>Last 10 purchases, issues, returns and repairs</p>
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 440, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th>Holder</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent || []).map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => openItem(t.itemId)}>
                    <td className="nowrap">{t.date || "—"}</td>
                    <td>
                      <span className={badgeClass(t.type)}>{t.type}</span>
                    </td>
                    <td>
                      {t.itemName} <span className="muted nowrap">({t.inventoryNo})</span>
                    </td>
                    <td className="num">{t.qty}</td>
                    <td>{t.issuedTo || <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {data?.recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No activity yet.
                    </td>
                  </tr>
                )}
                {!data && (
                  <tr>
                    <td colSpan={5} className="empty">
                      {placeholder}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
