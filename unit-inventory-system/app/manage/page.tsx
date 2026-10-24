"use client";

/* eslint-disable @next/next/no-img-element -- uploaded files are served by
   our own route and already compressed on upload. */

import { useMemo, useState } from "react";
import { api, errorText, sendJson, uploadFile, useToast } from "@/lib/client";
import { badgeClass, nextInventoryNo } from "@/lib/inventory";
import { useItems } from "@/lib/useItems";
import {
  CATEGORIES,
  CONDITIONS,
  STATUSES,
  emptyForm,
  type FormState,
  type Item,
} from "@/lib/types";

type Files = { voucher: File | null; notesheet: File | null; photo: File | null };
const noFiles: Files = { voucher: null, notesheet: null, photo: null };

export default function ManagePage() {
  const { items, loading, error, upsert, remove } = useItems();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<Files>(noFiles);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Changing this remounts the file inputs, clearing their chosen file names.
  const [formKey, setFormKey] = useState(0);
  const [message, showMessage] = useToast();

  const previewInventoryNo = useMemo(() => {
    if (editId && form.inventoryNo) return form.inventoryNo;
    return nextInventoryNo(items.map((i) => i.inventoryNo));
  }, [items, editId, form.inventoryNo]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setFiles(noFiles);
    setEditId(null);
    setFormKey((k) => k + 1);
  }

  function validateForm() {
    if (!form.itemName.trim()) return "Item Name is required.";
    if (!form.category.trim()) return "Category is required.";
    if (!Number.isInteger(form.quantity) || form.quantity < 1) return "Quantity must be a whole number of at least 1.";
    if (!form.buyDate) return "Buying Date is required.";
    if (Number.isNaN(Number(form.cost))) return "Cost is required.";
    if (Number(form.cost) < 0) return "Cost cannot be negative.";
    if (!form.voucherNo.trim()) return "Voucher No is required.";
    if (!form.voucherUrl && !files.voucher) return "Voucher File is required.";
    if (!editId && form.status === "Issued" && !form.issuedTo.trim()) {
      return "Issued To is required when status is Issued.";
    }
    return "";
  }

  async function saveItem() {
    if (busy) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      showMessage(validationMessage);
      return;
    }

    const wasEditing = Boolean(editId);
    setBusy(true);

    try {
      const [voucherUrl, notesheetUrl, productPhotoUrl] = await Promise.all([
        uploadFile(files.voucher, form.voucherUrl),
        uploadFile(files.notesheet, form.notesheetUrl),
        uploadFile(files.photo, form.productPhotoUrl),
      ]);

      const payload = { ...form, voucherUrl, notesheetUrl, productPhotoUrl };

      const saved = editId
        ? await sendJson<Item>(`/api/items/${editId}`, "PUT", payload)
        : await sendJson<Item>("/api/items", "POST", payload);

      upsert(saved);
      resetForm();
      showMessage(
        wasEditing
          ? `${saved.inventoryNo} updated successfully.`
          : `${saved.inventoryNo} saved successfully.`
      );
    } catch (err) {
      showMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function editItem(item: Item) {
    setEditId(item.id);
    setForm({
      inventoryNo: item.inventoryNo,
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      buyDate: item.buyDate,
      voucherNo: item.voucherNo,
      voucherUrl: item.voucherUrl,
      notesheetUrl: item.notesheetUrl,
      productPhotoUrl: item.productPhotoUrl,
      location: item.location,
      cost: item.cost,
      condition: item.condition,
      status: item.status,
      issuedTo: item.issuedTo,
      issueDate: item.issueDate,
      remarks: item.remarks,
    });
    setFiles(noFiles);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteItem(item: Item) {
    if (!confirm(`Delete ${item.inventoryNo} (${item.itemName}) and its full history permanently?`)) {
      return;
    }

    try {
      await api(`/api/items/${item.id}`, { method: "DELETE" });
      remove(item.id);
      if (editId === item.id) resetForm();
      showMessage("Item deleted.");
    } catch (err) {
      showMessage(errorText(err));
    }
  }

  // Keep categories that exist in old records selectable.
  const categoryOptions = CATEGORIES.includes(form.category as (typeof CATEGORIES)[number])
    ? CATEGORIES
    : [...CATEGORIES, form.category];

  return (
    <section>
      <div className="page-head row-head">
        <div>
          <h2>Add / Edit / Remove Items</h2>
          <p>Add new property, update existing item or remove wrong entry.</p>
        </div>

        <div className="auto-inv-box">
          <span>{editId ? "Editing Inventory No" : "Next Inventory No"}</span>
          <b>{previewInventoryNo}</b>
        </div>
      </div>

      <div className="manage-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>{editId ? "Edit Item" : "Add New Item"}</h2>
            <p>
              Fields marked with <b>*</b> are mandatory.
            </p>
          </div>

          <div className="form-grid two-field-form" key={formKey}>
            <label>
              Item Name *
              <input
                value={form.itemName}
                onChange={(e) => set("itemName", e.target.value)}
                placeholder="Table / Chair / Light"
                maxLength={200}
              />
            </label>

            <label>
              Category *
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                {categoryOptions.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <label>
              Quantity *
              <input
                type="number"
                min={1}
                step={1}
                value={form.quantity || ""}
                onChange={(e) => set("quantity", Number(e.target.value))}
              />
            </label>

            <label>
              Buying Date *
              <input type="date" value={form.buyDate} onChange={(e) => set("buyDate", e.target.value)} />
            </label>

            <label>
              Cost (৳) *
              <input
                type="number"
                min={0}
                value={form.cost}
                onChange={(e) => set("cost", Number(e.target.value))}
              />
            </label>

            <label>
              Location
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="QM Store"
              />
            </label>

            <label>
              Voucher No *
              <input
                value={form.voucherNo}
                onChange={(e) => set("voucherNo", e.target.value)}
                placeholder="CRV 112"
              />
            </label>

            <label>
              Condition *
              <select
                value={form.condition}
                onChange={(e) => set("condition", e.target.value as FormState["condition"])}
              >
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            {editId ? (
              <div className="full existing-file">
                <b>Status:</b> <span className={badgeClass(form.status)}>{form.status}</span>
                <br />
                Status and holders change through Issue / Return / Repair in the Inventory Register.
              </div>
            ) : (
              <>
                <label>
                  Initial Status *
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as FormState["status"])}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                {form.status === "Issued" ? (
                  <>
                    <label>
                      Issued To *
                      <input
                        value={form.issuedTo}
                        onChange={(e) => set("issuedTo", e.target.value)}
                        placeholder="Name / Rank / Office / Section"
                      />
                    </label>

                    <label>
                      Issue Date
                      <input
                        type="date"
                        value={form.issueDate}
                        onChange={(e) => set("issueDate", e.target.value)}
                      />
                    </label>
                  </>
                ) : (
                  <div />
                )}
              </>
            )}

            <label className="full">
              Voucher File * {form.voucherUrl && !files.voucher ? "(leave empty to keep current)" : ""}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFiles((f) => ({ ...f, voucher: e.target.files?.[0] || null }))}
              />
            </label>

            <label className="full">
              Notesheet
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFiles((f) => ({ ...f, notesheet: e.target.files?.[0] || null }))}
              />
            </label>

            <label className="full">
              Product Photo
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => setFiles((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
              />
            </label>

            {form.voucherUrl && (
              <div className="full existing-file">
                <b>Current Voucher:</b>{" "}
                <a href={form.voucherUrl} target="_blank" rel="noopener noreferrer">
                  Open Voucher
                </a>
              </div>
            )}

            {form.notesheetUrl && (
              <div className="full existing-file">
                <b>Current Notesheet:</b>{" "}
                <a href={form.notesheetUrl} target="_blank" rel="noopener noreferrer">
                  Open Notesheet
                </a>
              </div>
            )}

            {form.productPhotoUrl && (
              <div className="full existing-file">
                <b>Current Product Photo:</b>
                <br />
                <img src={form.productPhotoUrl} alt="Current product" className="product-preview" />
              </div>
            )}

            <label className="full">
              Remarks
              <textarea
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                placeholder="Additional notes"
              />
            </label>
          </div>

          <div className="actions">
            <button className="dark" onClick={resetForm} disabled={busy}>
              {editId ? "Cancel Edit" : "Clear"}
            </button>

            <button onClick={saveItem} disabled={busy}>
              {busy ? "Saving…" : editId ? "Update Item" : "Save Item"}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Edit / Remove Existing Items</h2>
            <p>Select an item to edit or remove wrong entry.</p>
          </div>

          <div className="table-wrap wrap-table-wrap">
            <table className="wrap-table manage-table">
              <thead>
                <tr>
                  <th>Ser</th>
                  <th>Photo</th>
                  <th>Inv No</th>
                  <th>Item</th>
                  <th>Cat</th>
                  <th>Qty</th>
                  <th>Issued To</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      {item.productPhotoUrl ? (
                        <img
                          src={item.productPhotoUrl}
                          alt={item.itemName}
                          className="item-thumb"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="wrap-cell strong-cell">{item.inventoryNo}</td>
                    <td className="wrap-cell">{item.itemName}</td>
                    <td className="wrap-cell">{item.category}</td>
                    <td>{item.quantity}</td>
                    <td className="wrap-cell">{item.issuedTo || "—"}</td>
                    <td className="wrap-cell">{item.location || "—"}</td>
                    <td>
                      <span className={badgeClass(item.status)}>{item.status}</span>
                    </td>
                    <td>
                      <div className="row-buttons">
                        <button className="small" onClick={() => editItem(item)} disabled={busy}>
                          Edit
                        </button>
                        <button className="small danger" onClick={() => deleteItem(item)} disabled={busy}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty">
                      {loading ? "Loading…" : error || "No item found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {message && <div className="toast" role="status">{message}</div>}
    </section>
  );
}
