"use client";

import { useEffect, useMemo, useState } from "react";
import type { Allocation, Item, TransactionType } from "@/lib/types";

type TransactionForm = {
  type: Exclude<TransactionType, "Purchase">;
  item: Item;
};

type PreviewFile = {
  title: string;
  url: string;
  type: "image" | "file";
};

function sumAllocations(allocations: Allocation[] = [], type: string) {
  return allocations
    .filter((allocation) => allocation.type === type)
    .reduce((sum, allocation) => sum + Number(allocation.qty || 0), 0);
}

function isImageFile(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Item | null>(null);
  const [message, setMessage] = useState("");

  const [filePreview, setFilePreview] = useState<PreviewFile | null>(null);

  const [txnForm, setTxnForm] = useState<TransactionForm | null>(null);
  const [txnQty, setTxnQty] = useState(1);
  const [txnIssuedTo, setTxnIssuedTo] = useState("");
  const [txnDate, setTxnDate] = useState("");
  const [txnVoucherNo, setTxnVoucherNo] = useState("");
  const [txnRemarks, setTxnRemarks] = useState("");

  async function loadItems() {
    const res = await fetch("/api/items", { cache: "no-store" });
    const data = await res.json();
    setItems(data);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  }

  function openPreview(title: string, url: string) {
    if (!url) {
      showMessage(`${title} is not available.`);
      return;
    }

    setFilePreview({
      title,
      url,
      type: isImageFile(url) ? "image" : "file",
    });
  }

  function openTransactionModal(
    type: Exclude<TransactionType, "Purchase">,
    item: Item
  ) {
    setTxnForm({ type, item });
    setTxnQty(1);
    setTxnIssuedTo("");
    setTxnDate(new Date().toISOString().slice(0, 10));
    setTxnVoucherNo("");
    setTxnRemarks("");
  }

  function closeTransactionModal() {
    setTxnForm(null);
    setTxnQty(1);
    setTxnIssuedTo("");
    setTxnDate("");
    setTxnVoucherNo("");
    setTxnRemarks("");
  }

  async function submitTransaction() {
    if (!txnForm) return;

    const { type, item } = txnForm;

    if (!txnQty || txnQty < 1) {
      showMessage("Valid quantity is required.");
      return;
    }

    const storeQty = sumAllocations(item.allocations, "In Store");
    const issuedQty = sumAllocations(item.allocations, "Issued");

    if (type === "Issue" && txnQty > storeQty) {
      showMessage("Issue quantity cannot exceed In Store quantity.");
      return;
    }

    if (type === "Return" && txnQty > issuedQty) {
      showMessage("Return quantity cannot exceed issued quantity.");
      return;
    }

    if ((type === "Repair" || type === "Damaged") && txnQty > storeQty) {
      showMessage(`${type} quantity cannot exceed In Store quantity.`);
      return;
    }

    if (type === "Issue" && !txnIssuedTo.trim()) {
      showMessage("Issued To field is required.");
      return;
    }

    const res = await fetch(`/api/items/${item.id}/transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        qty: txnQty,
        issuedTo: txnIssuedTo,
        voucherNo: txnVoucherNo,
        remarks: txnRemarks,
        date: txnDate || new Date().toISOString().slice(0, 10),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.message || "Transaction failed.");
      return;
    }

    await loadItems();
    setSelected(data);
    closeTransactionModal();
    showMessage(`${type} transaction completed successfully.`);
  }

  function exportCSV() {
    const header = [
      "Inventory No",
      "Item",
      "Category",
      "Total Qty",
      "In Store",
      "Issued",
      "Repair",
      "Damaged",
      "Voucher No",
      "Location",
      "Cost",
      "Condition",
      "Status",
      "Remarks",
    ];

    const rows = items.map((x) => [
      x.inventoryNo,
      x.itemName,
      x.category,
      x.quantity,
      sumAllocations(x.allocations, "In Store"),
      sumAllocations(x.allocations, "Issued"),
      sumAllocations(x.allocations, "Repair"),
      sumAllocations(x.allocations, "Damaged"),
      x.voucherNo,
      x.location,
      x.cost,
      x.condition,
      x.status,
      x.remarks,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "unit-inventory-register.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase().trim();

      const allocationText = (item.allocations || [])
        .map(
          (allocation) =>
            `${allocation.type} ${allocation.holder} ${allocation.location} ${allocation.voucherNo} ${allocation.remarks}`
        )
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !q ||
        item.inventoryNo.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.issuedTo.toLowerCase().includes(q) ||
        item.voucherNo.toLowerCase().includes(q) ||
        item.condition.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.remarks.toLowerCase().includes(q) ||
        allocationText.includes(q);

      const matchesFilter =
        filter === "All" || item.category === filter || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  function getTransactionTitle(type: string) {
    if (type === "Issue") return "Issue Item";
    if (type === "Return") return "Return Item";
    if (type === "Repair") return "Send for Repair";
    if (type === "Damaged") return "Mark as Damaged";
    return "Transaction";
  }

  function getTransactionNote(type: string) {
    if (type === "Issue") {
      return "Issue selected quantity to a person, office, company or section.";
    }

    if (type === "Return") {
      return "Return previously issued quantity back to store. Returned From is optional.";
    }

    if (type === "Repair") {
      return "This will move quantity from In Store to Repair Store.";
    }

    if (type === "Damaged") {
      return "This will move quantity from In Store to Damaged Store.";
    }

    return "";
  }

  return (
    <section>
      <div className="page-head row-head">
        <div>
          <h2>Inventory Register</h2>
          <p>View accountability, issue, return, repair and damaged records.</p>
        </div>

        <div className="page-actions">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inv no / item / holder / voucher no"
          />

          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <section className="panel">
        <div className="filters">
          {[
            "All",
            "Furniture",
            "Crockery",
            "Electrical",
            "Stationery",
            "Sports",
            "Kitchen",
            "Other",
            "In Store",
            "Issued",
            "Repair",
            "Damaged",
          ].map((f) => (
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
              {filtered.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>

                  <td>
                    {item.productPhotoUrl ? (
                      <img
                        src={item.productPhotoUrl}
                        alt={item.itemName}
                        className="item-thumb clickable-thumb"
                        onClick={() =>
                          openPreview("Product Photo", item.productPhotoUrl)
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="link" onClick={() => setSelected(item)}>
                    {item.inventoryNo}
                  </td>

                  <td>{item.itemName}</td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>{sumAllocations(item.allocations, "In Store")}</td>
                  <td>{sumAllocations(item.allocations, "Issued")}</td>
                  <td>{sumAllocations(item.allocations, "Repair")}</td>
                  <td>{sumAllocations(item.allocations, "Damaged")}</td>

                  <td>
                    {item.voucherUrl ? (
                      <button
                        className="small"
                        onClick={() => openPreview("Voucher", item.voucherUrl)}
                      >
                        {item.voucherNo || "View"}
                      </button>
                    ) : (
                      item.voucherNo || "—"
                    )}
                  </td>

                  <td>{item.condition}</td>

                  <td>
                    <span
                      className={`badge ${item.status
                        .replaceAll(" ", "-")
                        .toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td>
                    <button className="small" onClick={() => setSelected(item)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="empty">
                    No item found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="modal-bg" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{selected.itemName}</h2>
              <button onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="file-preview-strip">
              <div
                className={`mini-file-card ${
                  selected.productPhotoUrl ? "" : "disabled-file-card"
                }`}
                onClick={() => openPreview("Product Photo", selected.productPhotoUrl)}
              >
                <div className="mini-file-thumb">
                  {selected.productPhotoUrl ? (
                    <img src={selected.productPhotoUrl} alt="Product Photo" />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <b>Product Photo</b>
              </div>

              <div
                className={`mini-file-card ${
                  selected.voucherUrl ? "" : "disabled-file-card"
                }`}
                onClick={() => openPreview("Voucher", selected.voucherUrl)}
              >
                <div className="mini-file-thumb">
                  {selected.voucherUrl && isImageFile(selected.voucherUrl) ? (
                    <img src={selected.voucherUrl} alt="Voucher" />
                  ) : (
                    <span>📄</span>
                  )}
                </div>
                <b>Voucher</b>
              </div>

              <div
                className={`mini-file-card ${
                  selected.notesheetUrl ? "" : "disabled-file-card"
                }`}
                onClick={() => openPreview("Notesheet", selected.notesheetUrl)}
              >
                <div className="mini-file-thumb">
                  {selected.notesheetUrl && isImageFile(selected.notesheetUrl) ? (
                    <img src={selected.notesheetUrl} alt="Notesheet" />
                  ) : (
                    <span>📄</span>
                  )}
                </div>
                <b>Notesheet</b>
              </div>
            </div>

            <div className="detail-grid">
              <p>
                <b>Inventory No:</b> {selected.inventoryNo}
              </p>

              <p>
                <b>Category:</b> {selected.category}
              </p>

              <p>
                <b>Total Quantity:</b> {selected.quantity}
              </p>

              <p>
                <b>In Store:</b> {sumAllocations(selected.allocations, "In Store")}
              </p>

              <p>
                <b>Issued:</b> {sumAllocations(selected.allocations, "Issued")}
              </p>

              <p>
                <b>Repair:</b> {sumAllocations(selected.allocations, "Repair")}
              </p>

              <p>
                <b>Damaged:</b> {sumAllocations(selected.allocations, "Damaged")}
              </p>

              <p>
                <b>Buy Date:</b> {selected.buyDate || "—"}
              </p>

              <p>
                <b>Location:</b> {selected.location || "—"}
              </p>

              <p>
                <b>Cost:</b> ৳{selected.cost}
              </p>

              <p>
                <b>Condition:</b> {selected.condition}
              </p>

              <p>
                <b>Status:</b> {selected.status}
              </p>

              <p className="full">
                <b>Voucher No:</b> {selected.voucherNo || "—"}
              </p>

              <p className="full">
                <b>Remarks:</b> {selected.remarks || "—"}
              </p>
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
                  {(selected.allocations || []).map((allocation, index) => (
                    <tr key={allocation.id}>
                      <td>{index + 1}</td>

                      <td>
                        <span
                          className={`badge ${allocation.type
                            .replaceAll(" ", "-")
                            .toLowerCase()}`}
                        >
                          {allocation.type}
                        </span>
                      </td>

                      <td>{allocation.qty}</td>
                      <td>{allocation.holder || "—"}</td>
                      <td>{allocation.location || "—"}</td>
                      <td>{allocation.date || "—"}</td>
                      <td>{allocation.voucherNo || "—"}</td>
                      <td>{allocation.remarks || "—"}</td>
                    </tr>
                  ))}

                  {(!selected.allocations || selected.allocations.length === 0) && (
                    <tr>
                      <td colSpan={8} className="empty">
                        No accountability record found.
                      </td>
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
              <button onClick={() => openTransactionModal("Issue", selected)}>
                Issue
              </button>

              <button onClick={() => openTransactionModal("Return", selected)}>
                Return
              </button>

              <button onClick={() => openTransactionModal("Repair", selected)}>
                Repair
              </button>

              <button onClick={() => openTransactionModal("Damaged", selected)}>
                Damaged
              </button>

              <button className="dark" onClick={() => setSelected(null)}>
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
              <button onClick={() => setFilePreview(null)}>×</button>
            </div>

            <div className="file-preview-body">
              {filePreview.type === "image" ? (
                <img
                  src={filePreview.url}
                  alt={filePreview.title}
                  className="large-file-image"
                />
              ) : (
                <iframe
                  src={filePreview.url}
                  title={filePreview.title}
                  className="large-file-frame"
                />
              )}
            </div>

            <div className="file-preview-actions">
              <a href={filePreview.url} target="_blank">
                Open in New Tab
              </a>

              <button className="dark" onClick={() => setFilePreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {txnForm && (
        <div className="modal-bg" onClick={closeTransactionModal}>
          <div className="txn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{getTransactionTitle(txnForm.type)}</h2>
                <p className="modal-subtitle">
                  {txnForm.item.inventoryNo} — {txnForm.item.itemName}
                </p>
              </div>

              <button onClick={closeTransactionModal}>×</button>
            </div>

            <div className="txn-form-body">
              <div className="transaction-info-box">
                <div>
                  <span>Total</span>
                  <b>{txnForm.item.quantity}</b>
                </div>

                <div>
                  <span>In Store</span>
                  <b>{sumAllocations(txnForm.item.allocations, "In Store")}</b>
                </div>

                <div>
                  <span>Issued</span>
                  <b>{sumAllocations(txnForm.item.allocations, "Issued")}</b>
                </div>

                <div>
                  <span>Repair</span>
                  <b>{sumAllocations(txnForm.item.allocations, "Repair")}</b>
                </div>
              </div>

              <p className="txn-help-text">{getTransactionNote(txnForm.type)}</p>

              <div className="form-grid two-field-form txn-form-grid">
                <label>
                  Transaction Type
                  <input value={txnForm.type} readOnly />
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    value={txnQty}
                    onChange={(e) => setTxnQty(Number(e.target.value))}
                  />
                </label>

                {txnForm.type === "Issue" && (
                  <label className="full">
                    Issued To *
                    <input
                      value={txnIssuedTo}
                      onChange={(e) => setTxnIssuedTo(e.target.value)}
                      placeholder="Snk A / Office / Section"
                    />
                  </label>
                )}

                {txnForm.type === "Return" && (
                  <label className="full">
                    Returned From
                    <select
                      value={txnIssuedTo}
                      onChange={(e) => setTxnIssuedTo(e.target.value)}
                    >
                      <option value="">Any issued holder</option>
                      {(txnForm.item.allocations || [])
                        .filter((allocation) => allocation.type === "Issued")
                        .map((allocation) => (
                          <option key={allocation.id} value={allocation.holder}>
                            {allocation.holder} — Qty {allocation.qty}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                <label>
                  Date
                  <input
                    type="date"
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                  />
                </label>

                <label>
                  Voucher / Note No
                  <input
                    value={txnVoucherNo}
                    onChange={(e) => setTxnVoucherNo(e.target.value)}
                    placeholder="Issue voucher / return note / repair note"
                  />
                </label>

                <label className="full">
                  Remarks
                  <textarea
                    value={txnRemarks}
                    onChange={(e) => setTxnRemarks(e.target.value)}
                    placeholder="Additional remarks"
                  />
                </label>
              </div>
            </div>

            <div className="modal-actions txn-submit-row">
              <button className="dark" onClick={closeTransactionModal}>
                Cancel
              </button>

              <button onClick={submitTransaction}>Submit {txnForm.type}</button>
            </div>
          </div>
        </div>
      )}

      {message && <div className="toast">{message}</div>}
    </section>
  );
}