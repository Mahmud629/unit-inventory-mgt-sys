"use client";

/* eslint-disable @next/next/no-img-element -- uploaded files are served by
   our own route and already compressed on upload. */

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { errorText, sendJson, useEscape, useToast } from "@/lib/client";
import {
  badgeClass,
  getBreakdown,
  getIssuedHolders,
  isImageFile,
  localDate,
  searchText,
  type Breakdown,
} from "@/lib/inventory";
import { useItems } from "@/lib/useItems";
import { CATEGORIES, STATUSES, type Item, type MovementType } from "@/lib/types";

type PreviewFile = { title: string; url: string; image: boolean };

type TxnState = {
  type: MovementType;
  itemId: string;
  qty: number;
  issuedTo: string;
  date: string;
  voucherNo: string;
  remarks: string;
};

const FILTERS = ["All", ...CATEGORIES, ...STATUSES];

const MOVEMENTS: {
  type: MovementType;
  button: string;
  title: string;
  note: string;
  from: keyof Breakdown;
}[] = [
  {
    type: "Issue",
    button: "Issue",
    title: "Issue Item",
    note: "Issue selected quantity to a person, office, company or section.",
    from: "In Store",
  },
  {
    type: "Return",
    button: "Return",
    title: "Return Item",
    note: "Return previously issued quantity back to store. Returned From is optional.",
    from: "Issued",
  },
  {
    type: "Repair",
    button: "Repair",
    title: "Send for Repair",
    note: "This will move quantity from In Store to Repair Store.",
    from: "In Store",
  },
  {
    type: "Repaired",
    button: "Back from Repair",
    title: "Back from Repair",
    note: "This will move repaired quantity from Repair Store back to In Store.",
    from: "Repair",
  },
  {
    type: "Damaged",
    button: "Damaged",
    title: "Mark as Damaged",
    note: "This will move quantity from In Store to Damaged Store.",
    from: "In Store",
  },
];

const today = () => localDate();

const EMPTY_HINT: Record<keyof Breakdown, string> = {
  "In Store": "Nothing in store",
  Issued: "Nothing issued",
  Repair: "Nothing in repair",
  Damaged: "Nothing damaged",
};

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function InventoryPage() {
  const { items, loading, error, upsert } = useItems();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<PreviewFile | null>(null);
  const [txn, setTxn] = useState<TxnState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, showMessage] = useToast();

  // Typing stays responsive; filtering catches up a moment later.
  const deferredSearch = useDeferredValue(search);

  // Work that only changes when the data changes, not on every keystroke.
  const rows = useMemo(
    () =>
      items.map((item) => ({
        item,
        breakdown: getBreakdown(item.allocations),
        text: searchText(item),
      })),
    [items]
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();

    return rows.filter(
      ({ item, text }) =>
        (filter === "All" || item.category === filter || item.status === filter) &&
        (!q || text.includes(q))
    );
  }, [rows, deferredSearch, filter]);

  const selectedRow = rows.find((r) => r.item.id === selectedId) || null;
  const txnRow = txn ? rows.find((r) => r.item.id === txn.itemId) || null : null;
  const txnConfig = txn ? MOVEMENTS.find((m) => m.type === txn.type)! : null;

  const closeTopModal = useCallback(() => {
    if (filePreview) setFilePreview(null);
    else if (txn) setTxn(null);
    else setSelectedId(null);
  }, [filePreview, txn]);

  useEscape(filePreview || txn || selectedId ? closeTopModal : null);

  function openPreview(title: string, url: string) {
    if (!url) {
      showMessage(`${title} is not available.`);
      return;
    }
    setFilePreview({ title, url, image: isImageFile(url) });
  }

  function openTransaction(type: MovementType, item: Item) {
    setTxn({ type, itemId: item.id, qty: 1, issuedTo: "", date: today(), voucherNo: "", remarks: "" });
  }

  async function submitTransaction() {
    if (!txn || !txnRow || !txnConfig || busy) return;

    const available =
      txn.type === "Return" && txn.issuedTo
        ? getIssuedHolders(txnRow.item.allocations).find((h) => h.holder === txn.issuedTo)?.qty || 0
        : txnRow.breakdown[txnConfig.from];

    if (!Number.isInteger(txn.qty) || txn.qty < 1) {
      showMessage("Valid quantity is required.");
      return;
    }
    if (txn.qty > available) {
      showMessage(`Quantity cannot exceed ${available} (${txnConfig.from}).`);
      return;
    }
    if (txn.type === "Issue" && !txn.issuedTo.trim()) {
      showMessage("Issued To field is required.");
      return;
    }

    setBusy(true);

    try {
      const updated = await sendJson<Item>(`/api/items/${txn.itemId}/transaction`, "POST", {
        ...txn,
        date: txn.date || today(),
      });

      upsert(updated);
      setTxn(null);
      showMessage(`${txnConfig.title} completed successfully.`);
    } catch (err) {
      showMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function exportCSV() {
    const header = [
      "Inventory No", "Item", "Category", "Total Qty", "In Store", "Issued",
      "Repair", "Damaged", "Issued To", "Voucher No", "Location", "Cost",
      "Condition", "Status", "Remarks",
    ];

    const lines = rows.map(({ item: x, breakdown: b }) => [
      x.inventoryNo, x.itemName, x.category, x.quantity, b["In Store"], b.Issued,
      b.Repair, b.Damaged,
      getIssuedHolders(x.allocations).map((h) => `${h.holder} (${h.qty})`).join("; "),
      x.voucherNo, x.location, x.cost, x.condition, x.status, x.remarks,
    ]);

    // The BOM makes Excel read Bangla text and ৳ correctly.
    const csv = "﻿" + [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `unit-inventory-register-${today()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const selected = selectedRow?.item;
  const sb = selectedRow?.breakdown;

  return (
    <section>
      <div className="page-head row-head">
        <div>
          <h2>Inventory Register</h2>
          <p>View accountability, issue, return, repair and damaged records.</p>
        </div>

        <div className="page-actions">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inv no / item / holder / voucher no"
          />

          <button onClick={exportCSV} disabled={items.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={filter === f ? "active-filter" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ser</th>
                <th>Photo</th>
                <th>Inv No</th>
                <th>Item</th>
                <th>Category</th>
                <th>Total</th>
                <th>In Store</th>
                <th>Issued</th>
                <th>Repair</th>
                <th>Damaged</th>
                <th>Voucher No</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(({ item, breakdown: b }, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>

                  <td>
                    {item.productPhotoUrl ? (
                      <img
                        src={item.productPhotoUrl}
                        alt={item.itemName}
                        className="item-thumb clickable-thumb"
                        loading="lazy"
                        decoding="async"
                        onClick={() => openPreview("Product Photo", item.productPhotoUrl)}
                      />
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="link" onClick={() => setSelectedId(item.id)}>
                    {item.inventoryNo}
                  </td>

                  <td>{item.itemName}</td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>{b["In Store"]}</td>
                  <td>{b.Issued}</td>
                  <td>{b.Repair}</td>
                  <td>{b.Damaged}</td>

                  <td>
                    {item.voucherUrl ? (
                      <button className="small" onClick={() => openPreview("Voucher", item.voucherUrl)}>
                        {item.voucherNo || "View"}
                      </button>
                    ) : (
                      item.voucherNo || "—"
                    )}
                  </td>

                  <td>{item.condition}</td>

                  <td>
                    <span className={badgeClass(item.status)}>{item.status}</span>
                  </td>

                  <td>
                    <button className="small" onClick={() => setSelectedId(item.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="empty">
                    {loading ? "Loading…" : error || "No item found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && items.length > 0 && (
          <p className="result-count">
            Showing {filtered.length} of {items.length} item lines
          </p>
        )}
      </section>

      {selected && sb && (
        <div className="modal-bg" onClick={() => setSelectedId(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{selected.itemName}</h2>
              <button onClick={() => setSelectedId(null)} aria-label="Close">×</button>
            </div>

            <div className="file-preview-strip">
              {[
                { title: "Product Photo", url: selected.productPhotoUrl },
                { title: "Voucher", url: selected.voucherUrl },
                { title: "Notesheet", url: selected.notesheetUrl },
              ].map((file) => (
                <div
                  key={file.title}
                  className={`mini-file-card ${file.url ? "" : "disabled-file-card"}`}
                  onClick={() => openPreview(file.title, file.url)}
                >
                  <div className="mini-file-thumb">
                    {file.url && isImageFile(file.url) ? (
                      <img src={file.url} alt={file.title} loading="lazy" />
                    ) : (
                      <span>{file.url ? "📄" : "—"}</span>
                    )}
                  </div>
                  <b>{file.title}</b>
                </div>
              ))}
            </div>

            <div className="detail-grid">
              <p><b>Inventory No:</b> {selected.inventoryNo}</p>
              <p><b>Category:</b> {selected.category}</p>
              <p><b>Total Quantity:</b> {selected.quantity}</p>
              <p><b>In Store:</b> {sb["In Store"]}</p>
              <p><b>Issued:</b> {sb.Issued}</p>
              <p><b>Repair:</b> {sb.Repair}</p>
              <p><b>Damaged:</b> {sb.Damaged}</p>
              <p><b>Buy Date:</b> {selected.buyDate || "—"}</p>
              <p><b>Location:</b> {selected.location || "—"}</p>
              <p><b>Cost:</b> ৳{selected.cost.toLocaleString("en-IN")}</p>
              <p><b>Condition:</b> {selected.condition}</p>
              <p><b>Status:</b> {selected.status}</p>
              <p className="full"><b>Voucher No:</b> {selected.voucherNo || "—"}</p>
              <p className="full"><b>Remarks:</b> {selected.remarks || "—"}</p>
            </div>

            <h3>Accountability Details</h3>

            <div className="table-wrap modal-table-wrap">
              <table className="accountability-table">
                <thead>
                  <tr>
                    <th>Ser</th>
                    <th>Status</th>
                    <th>Qty</th>
                    <th>Holder</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Voucher/Note</th>
                    <th>Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {selected.allocations.map((allocation, index) => (
                    <tr key={allocation.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className={badgeClass(allocation.type)}>{allocation.type}</span>
                      </td>
                      <td>{allocation.qty}</td>
                      <td>{allocation.holder || "—"}</td>
                      <td>{allocation.location || "—"}</td>
                      <td>{allocation.date || "—"}</td>
                      <td>{allocation.voucherNo || "—"}</td>
                      <td>{allocation.remarks || "—"}</td>
                    </tr>
                  ))}

                  {selected.allocations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">No accountability record found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3>Transaction History</h3>

            <div className="txn-box">
              {selected.transactions.length === 0 ? (
                <p>No transaction yet.</p>
              ) : (
                selected.transactions.map((t) => (
                  <div key={t.id} className="txn">
                    <b>{t.type}</b> — Qty {t.qty} — {t.date}
                    {t.issuedTo ? <span> — {t.issuedTo}</span> : null}
                    {t.voucherNo ? <span> — Voucher: {t.voucherNo}</span> : null}
                    {t.remarks ? <span> — {t.remarks}</span> : null}
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              {MOVEMENTS.map((m) => (
                <button
                  key={m.type}
                  onClick={() => openTransaction(m.type, selected)}
                  disabled={sb[m.from] === 0}
                  title={sb[m.from] === 0 ? EMPTY_HINT[m.from] : m.title}
                >
                  {m.button}
                </button>
              ))}

              <button className="dark" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {filePreview && (
        <div className="file-preview-bg" onClick={() => setFilePreview(null)}>
          <div className="file-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="file-preview-head">
              <h2>{filePreview.title}</h2>
              <button onClick={() => setFilePreview(null)} aria-label="Close">×</button>
            </div>

            <div className="file-preview-body">
              {filePreview.image ? (
                <img src={filePreview.url} alt={filePreview.title} className="large-file-image" />
              ) : (
                <iframe src={filePreview.url} title={filePreview.title} className="large-file-frame" />
              )}
            </div>

            <div className="file-preview-actions">
              <a href={filePreview.url} target="_blank" rel="noopener noreferrer">
                Open in New Tab
              </a>
              <button className="dark" onClick={() => setFilePreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {txn && txnRow && txnConfig && (
        <div className="modal-bg" onClick={() => setTxn(null)}>
          <div className="txn-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{txnConfig.title}</h2>
                <p className="modal-subtitle">
                  {txnRow.item.inventoryNo} — {txnRow.item.itemName}
                </p>
              </div>
              <button onClick={() => setTxn(null)} aria-label="Close">×</button>
            </div>

            <div className="txn-form-body">
              <div className="transaction-info-box">
                <div><span>Total</span><b>{txnRow.item.quantity}</b></div>
                <div><span>In Store</span><b>{txnRow.breakdown["In Store"]}</b></div>
                <div><span>Issued</span><b>{txnRow.breakdown.Issued}</b></div>
                <div><span>Repair</span><b>{txnRow.breakdown.Repair}</b></div>
              </div>

              <p className="txn-help-text">{txnConfig.note}</p>

              <div className="form-grid two-field-form txn-form-grid">
                <label>
                  Transaction Type
                  <input value={txnConfig.title} readOnly />
                </label>

                <label>
                  Quantity (max {txnRow.breakdown[txnConfig.from]})
                  <input
                    type="number"
                    min={1}
                    max={txnRow.breakdown[txnConfig.from]}
                    value={txn.qty || ""}
                    onChange={(e) => setTxn({ ...txn, qty: Number(e.target.value) })}
                    autoFocus
                  />
                </label>

                {txn.type === "Issue" && (
                  <label className="full">
                    Issued To *
                    <input
                      value={txn.issuedTo}
                      onChange={(e) => setTxn({ ...txn, issuedTo: e.target.value })}
                      placeholder="Snk A / Office / Section"
                    />
                  </label>
                )}

                {txn.type === "Return" && (
                  <label className="full">
                    Returned From
                    <select
                      value={txn.issuedTo}
                      onChange={(e) => setTxn({ ...txn, issuedTo: e.target.value })}
                    >
                      <option value="">Any issued holder</option>
                      {getIssuedHolders(txnRow.item.allocations).map((h) => (
                        <option key={h.holder} value={h.holder}>
                          {h.holder} — Qty {h.qty}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  Date
                  <input
                    type="date"
                    value={txn.date}
                    max={today()}
                    onChange={(e) => setTxn({ ...txn, date: e.target.value })}
                  />
                </label>

                <label>
                  Voucher / Note No
                  <input
                    value={txn.voucherNo}
                    onChange={(e) => setTxn({ ...txn, voucherNo: e.target.value })}
                    placeholder="Issue voucher / return note / repair note"
                  />
                </label>

                <label className="full">
                  Remarks
                  <textarea
                    value={txn.remarks}
                    onChange={(e) => setTxn({ ...txn, remarks: e.target.value })}
                    placeholder="Additional remarks"
                  />
                </label>
              </div>
            </div>

            <div className="modal-actions txn-submit-row">
              <button className="dark" onClick={() => setTxn(null)}>
                Cancel
              </button>
              <button onClick={submitTransaction} disabled={busy}>
                {busy ? "Saving…" : `Submit ${txnConfig.button}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <div className="toast" role="status">{message}</div>}
    </section>
  );
}
