"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item, Transaction } from "@/lib/types";

type DashboardTransaction = Transaction & {
  itemName: string;
  inventoryNo: string;
  category: string;
};

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);

  async function loadItems() {
    const res = await fetch("/api/items", { cache: "no-store" });
    const data = await res.json();
    setItems(data);
  }

  useEffect(() => {
    loadItems();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.reduce((sum, x) => sum + x.quantity, 0),
      issued: items.reduce((sum, x) => sum + x.issuedQty, 0),
      store: items.reduce((sum, x) => sum + x.availableQty, 0),
      repair: items.filter((x) => x.status === "Repair").length,
    };
  }, [items]);

  const recentTransactions = useMemo<DashboardTransaction[]>(() => {
    return items
      .flatMap((item) =>
        item.transactions.map((txn) => ({
          ...txn,
          itemName: item.itemName,
          inventoryNo: item.inventoryNo,
          category: item.category,
        }))
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10);
  }, [items]);

  return (
    <section>
      <div className="page-head">
        <h2>Dashboard</h2>
        <p>Summary of unit property inventory.</p>
      </div>

      <div className="dashboard-grid dashboard-four">
        <div className="big-card">
          <p>Total Items</p>
          <h2>{stats.total}</h2>
        </div>

        <div className="big-card">
          <p>Issued Items</p>
          <h2>{stats.issued}</h2>
        </div>

        <div className="big-card">
          <p>In Store</p>
          <h2>{stats.store}</h2>
        </div>

        <div className="big-card">
          <p>Repair</p>
          <h2>{stats.repair}</h2>
        </div>
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
              {recentTransactions.map((txn, index) => (
                <tr key={txn.id}>
                  <td>{index + 1}</td>
                  <td>{txn.date || "—"}</td>

                  <td>
                    <span
                      className={`badge ${txn.type
                        .replaceAll(" ", "-")
                        .toLowerCase()}`}
                    >
                      {txn.type}
                    </span>
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

              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    No transaction found.
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