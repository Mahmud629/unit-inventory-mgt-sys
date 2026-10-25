"use client";

/* eslint-disable @next/next/no-img-element -- uploaded files are served by
   our own route and already compressed on upload. */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useMemo, useState } from "react";
import ItemDetail from "@/app/components/ItemDetail";
import ItemForm from "@/app/components/ItemForm";
import MovementForm from "@/app/components/MovementForm";
import { ConfirmDialog, Modal, Toast } from "@/app/components/ui";
import { api, errorText, useToast } from "@/lib/client";
import {
  badgeClass,
  getBreakdown,
  getIssuedHolders,
  isImageFile,
  localDate,
  searchText,
} from "@/lib/inventory";
import { useItems } from "@/lib/useItems";
import { CATEGORIES, STATUSES, type MovementType, type Status } from "@/lib/types";

type Preview = { title: string; url: string };

function movementMessage(type: MovementType, qty: number, holder: string) {
  switch (type) {
    case "Issue":
      return `Issued ${qty} to ${holder}.`;
    case "Return":
      return `${qty} returned to store${holder ? ` from ${holder}` : ""}.`;
    case "Repair":
      return `${qty} sent for repair.`;
    case "Repaired":
      return `${qty} back in store from repair.`;
    case "Damaged":
      return `${qty} marked as damaged.`;
  }
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function InventoryRegister() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { items, loading, error, upsert, remove } = useItems();
  const [toast, showToast] = useToast();

  const [search, setSearch] = useState(() => params.get("q") || "");
  const [category, setCategory] = useState(() => params.get("category") || "");
  const [status, setStatus] = useState(() => params.get("status") || "");
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("item"));
  const [editing, setEditing] = useState(false);
  const [movement, setMovement] = useState<MovementType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  // "Add Item" links (header, dashboard) open the form with ?new=1.
  const adding = params.has("new");

  const updateUrl = useCallback(
    (change: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      change(next);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  // Typing stays smooth; filtering catches up a moment later.
  const deferredSearch = useDeferredValue(search);

  const rows = useMemo(
    () => items.map((item) => ({ item, b: getBreakdown(item.allocations), text: searchText(item) })),
    [items]
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return rows.filter(
      (r) =>
        (!category || r.item.category === category) &&
        (!status || r.b[status as Status] > 0) &&
        (!q || r.text.includes(q))
    );
  }, [rows, deferredSearch, category, status]);

  const categories = useMemo(() => {
    const extra = items.map((i) => i.category).filter((c) => !CATEGORIES.includes(c as never));
    return [...CATEGORIES, ...new Set(extra)];
  }, [items]);

  // Names used before, offered as suggestions when issuing.
  const holders = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      for (const h of getIssuedHolders(item.allocations)) names.add(h.holder);
      for (const t of item.transactions) if (t.type === "Issue" && t.issuedTo) names.add(t.issuedTo);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const selected = items.find((i) => i.id === selectedId) || null;
  const filtersOn = Boolean(search || category || status);

  function openItem(id: string) {
    setSelectedId(id);
  }

  function closeItem() {
    setSelectedId(null);
    if (params.has("item")) updateUrl((p) => p.delete("item"));
  }

  function closeAdd() {
    updateUrl((p) => p.delete("new"));
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
  }

  async function deleteSelected() {
    if (!selected) return;
    try {
      await api(`/api/items/${selected.id}`, { method: "DELETE" });
      remove(selected.id);
      setConfirmDelete(false);
      closeItem();
      showToast(`${selected.inventoryNo} deleted.`);
    } catch (err) {
      showToast(errorText(err), { kind: "error" });
    }
  }

  function openPreview(title: string, url: string) {
    if (url) setPreview({ title, url });
  }

  function exportCSV() {
    const header = [
      "Inventory No", "Item", "Category", "Total", "In Store", "Issued", "Repair", "Damaged",
      "Held By", "Voucher No", "Buying Date", "Cost", "Location", "Condition", "Status", "Remarks",
    ];

    const lines = filtered.map(({ item: x, b }) => [
      x.inventoryNo, x.itemName, x.category, x.quantity, b["In Store"], b.Issued, b.Repair, b.Damaged,
      getIssuedHolders(x.allocations).map((h) => `${h.holder} (${h.qty})`).join("; "),
      x.voucherNo, x.buyDate, x.cost, x.location, x.condition, x.status, x.remarks,
    ]);

    // The BOM makes Excel read Bangla text and ৳ correctly.
    const csv = "﻿" + [header, ...lines].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-register-${localDate()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filterSummary = [
    category && `Category: ${category}`,
    status && `Status: ${status}`,
    search && `Search: "${search}"`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <h2>Inventory Register</h2>
          <p>Click any item to see where it is, issue it, take it back, or edit it.</p>
        </div>
        <Link className="btn" href="/inventory?new=1" replace scroll={false}>
          + Add Item
        </Link>
      </div>

      <div className="print-only print-title">
        <h1>5 Signal Battalion — Unit Inventory Register</h1>
        <p>
          Printed {new Date().toLocaleString("en-GB")} · {filtered.length} item lines
          {filterSummary ? ` · ${filterSummary}` : ""}
        </p>
      </div>

      <section className="card">
        <div className="toolbar">
          <input
            className="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, inv no, holder, voucher, location…"
            aria-label="Search"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                Has {s === "In Store" ? "stock in store" : s.toLowerCase()}
              </option>
            ))}
          </select>
          {filtersOn && (
            <button type="button" className="btn btn-ghost" onClick={clearFilters}>
              Clear
            </button>
          )}
          <div className="toolbar-end">
            <button type="button" className="btn btn-ghost" onClick={() => window.print()} disabled={!filtered.length}>
              Print
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportCSV} disabled={!filtered.length}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table-register">
            <thead>
              <tr>
                <th className="num">Ser</th>
                <th>Item</th>
                <th>Category</th>
                <th className="num">Total</th>
                <th className="num">In Store</th>
                <th className="num">Issued</th>
                <th className="num">Repair</th>
                <th className="num">Damaged</th>
                <th>Status</th>
                <th>Held by</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ item, b }, index) => (
                <tr key={item.id} className="clickable" onClick={() => openItem(item.id)}>
                  <td className="num hide-sm">{index + 1}</td>
                  <td className="cell-main">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {item.productPhotoUrl ? (
                        <img
                          src={item.productPhotoUrl}
                          alt=""
                          className="thumb no-print"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="thumb thumb-empty no-print">—</span>
                      )}
                      <div>
                        <div style={{ fontWeight: 800 }}>{item.itemName}</div>
                        <a
                          href={`?item=${item.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openItem(item.id);
                          }}
                          className="nowrap"
                        >
                          {item.inventoryNo}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td data-label="Category">{item.category}</td>
                  <td data-label="Total" className="num">{item.quantity}</td>
                  <td data-label="In Store" className={`num ${b["In Store"] ? "" : "zero"}`}>{b["In Store"]}</td>
                  <td data-label="Issued" className={`num ${b.Issued ? "" : "zero"}`}>{b.Issued}</td>
                  <td data-label="Repair" className={`num ${b.Repair ? "" : "zero"}`}>{b.Repair}</td>
                  <td data-label="Damaged" className={`num ${b.Damaged ? "" : "zero"}`}>{b.Damaged}</td>
                  <td data-label="Status">
                    <span className={badgeClass(item.status)}>{item.status}</span>
                  </td>
                  <td data-label="Held by" className="wrap">
                    {item.issuedTo || <span className="muted">—</span>}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    {loading ? (
                      "Loading…"
                    ) : error ? (
                      error
                    ) : items.length === 0 ? (
                      <>
                        No items yet.{" "}
                        <Link href="/inventory?new=1" replace scroll={false}>
                          Add the first item
                        </Link>
                      </>
                    ) : (
                      <>
                        Nothing matches these filters.{" "}
                        <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && items.length > 0 && (
          <div className="table-foot no-print">
            Showing {filtered.length} of {items.length} item lines ·{" "}
            {filtered.reduce((s, r) => s + r.item.quantity, 0)} pieces
          </div>
        )}
      </section>

      <div className="print-only signatures">
        <div>Prepared by (QM Store)</div>
        <div>Checked by</div>
        <div>Countersigned (Adjt / OC)</div>
      </div>

      {selected && (
        <ItemDetail
          item={selected}
          onClose={closeItem}
          onMove={setMovement}
          onEdit={() => setEditing(true)}
          onDelete={() => setConfirmDelete(true)}
          onPreview={openPreview}
        />
      )}

      {selected && movement && (
        <MovementForm
          item={selected}
          type={movement}
          holders={holders}
          onClose={() => setMovement(null)}
          onDone={(updated) => {
            upsert(updated);
            setMovement(null);
            const txn = updated.transactions[0];
            showToast(movementMessage(movement, txn?.qty || 0, txn?.issuedTo || ""), {
              action: txn ? { label: "Print voucher", href: `/print/voucher/${updated.id}/${txn.id}` } : undefined,
            });
          }}
        />
      )}

      {(adding || (selected && editing)) && (
        <ItemForm
          item={adding ? null : selected}
          items={items}
          onClose={() => (adding ? closeAdd() : setEditing(false))}
          onSaved={(saved, created) => {
            upsert(saved);
            if (created) {
              closeAdd();
              showToast(`${saved.inventoryNo} added to the register.`);
            } else {
              setEditing(false);
              showToast("Changes saved.");
            }
          }}
        />
      )}

      {selected && confirmDelete && (
        <ConfirmDialog
          title="Delete item?"
          danger
          confirmLabel="Delete permanently"
          message={
            <p>
              <b>
                {selected.inventoryNo} — {selected.itemName}
              </b>{" "}
              and its complete history will be removed. This cannot be undone.
            </p>
          }
          onConfirm={deleteSelected}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {preview && (
        <Modal
          size="lg"
          title={preview.title}
          onClose={() => setPreview(null)}
          footer={
            <>
              <a className="btn btn-ghost" href={preview.url} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
              <button type="button" className="btn btn-dark" onClick={() => setPreview(null)}>
                Close
              </button>
            </>
          }
        >
          {isImageFile(preview.url) ? (
            <img src={preview.url} alt={preview.title} className="preview-image" />
          ) : (
            <iframe src={preview.url} title={preview.title} className="preview-frame" />
          )}
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="page">Loading…</div>}>
      <InventoryRegister />
    </Suspense>
  );
}
