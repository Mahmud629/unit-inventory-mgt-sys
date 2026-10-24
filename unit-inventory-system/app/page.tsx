"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/client";
import { badgeClass } from "@/lib/inventory";
import type { DashboardData } from "@/lib/types";

const CARDS: { key: keyof DashboardData["stats"]; label: string }[] = [
  { key: "total", label: "Total Items" },
  { key: "store", label: "In Store" },
  { key: "issued", label: "Issued Items" },
  { key: "repair", label: "In Repair" },
  { key: "damaged", label: "Damaged" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(errorText(err)));
  }, []);

  const recent = data?.recent || [];

  return (
    <section>
      <div className="page-head">
        <h2>Dashboard</h2>
        <p>
          Summary of unit property inventory
          {data ? ` — ${data.stats.lines} item line${data.stats.lines === 1 ? "" : "s"}` : ""}.
        </p>
      </div>

      <div className="dashboard-grid dashboard-five">
        {CARDS.map((card) => (
          <div className="big-card" key={card.key}>
            <p>{card.label}</p>
            <h2>{data ? data.stats[card.key] : "…"}</h2>
          </div>
        ))}
      </div>

      <section className="panel recent-panel">
        <div className="panel-head">
          <h2>Recent Transactions</h2>
          <p>Latest purchase, issue, return, repair and damaged records.</p>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ser</th>
                <th>Date</th>
                <th>Transaction</th>
                <th>Inv No</th>
                <th>Item</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Issued To</th>
                <th>Voucher No</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {recent.map((txn, index) => (
                <tr key={txn.id}>
                  <td>{index + 1}</td>
                  <td>{txn.date || "—"}</td>
                  <td>
                    <span className={badgeClass(txn.type)}>{txn.type}</span>
                  </td>
                  <td className="link">{txn.inventoryNo}</td>
                  <td>{txn.itemName}</td>
                  <td>{txn.category}</td>
                  <td>{txn.qty}</td>
                  <td>{txn.issuedTo || "—"}</td>
                  <td>{txn.voucherNo || "—"}</td>
                  <td>{txn.remarks || "—"}</td>
                </tr>
              ))}

              {recent.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    {error || (data ? "No transaction found." : "Loading…")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
