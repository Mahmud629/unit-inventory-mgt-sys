"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormState, Item } from "@/lib/types";
import { emptyForm } from "@/lib/types";

export default function ManagePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedNotesheet, setSelectedNotesheet] = useState<File | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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

  const previewInventoryNo = useMemo(() => {
    if (editId && form.inventoryNo) return form.inventoryNo;
    return generateNextInventoryNo(items);
  }, [items, editId, form.inventoryNo]);

  function generateNextInventoryNo(currentItems: Item[]) {
    const year = new Date().getFullYear();

    const numbers = currentItems
      .map((item) => {
        const match = item.inventoryNo.match(/INV-5SIG-\d{4}-(\d+)/);
        return match ? Number(match[1]) : 0;
      })
      .filter((num) => !Number.isNaN(num));

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

    return `INV-5SIG-${year}-${String(nextNumber).padStart(4, "0")}`;
  }

  async function uploadFile(file: File | null, existingUrl: string) {
    if (!file) return existingUrl;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "File upload failed.");
    }

    return data.url;
  }

  function validateForm() {
    if (!form.itemName.trim()) return "Item Name is required.";
    if (!form.category.trim()) return "Category is required.";
    if (!form.quantity || form.quantity < 1) return "Quantity is required.";
    if (!form.buyDate.trim()) return "Buying Date is required.";
    if (form.cost === null || form.cost === undefined || Number.isNaN(Number(form.cost))) {
      return "Cost is required.";
    }
    if (Number(form.cost) < 0) return "Cost cannot be negative.";
    if (!form.voucherNo.trim()) return "Voucher No is required.";
    if (!form.condition.trim()) return "Condition is required.";
    if (!form.status.trim()) return "Status is required.";

    if (!editId && !selectedFile) {
      return "Voucher File is required.";
    }

    if (editId && !form.voucherUrl && !selectedFile) {
      return "Voucher File is required.";
    }

    return "";
  }

  async function saveItem() {
    try {
      const validationMessage = validateForm();

      if (validationMessage) {
        showMessage(validationMessage);
        return;
      }

      const voucherUrl = await uploadFile(selectedFile, form.voucherUrl);
      const notesheetUrl = await uploadFile(selectedNotesheet, form.notesheetUrl);
      const productPhotoUrl = await uploadFile(selectedPhoto, form.productPhotoUrl);

      const payload = {
        ...form,
        inventoryNo: editId ? form.inventoryNo : previewInventoryNo,
        voucherUrl,
        notesheetUrl,
        productPhotoUrl,
      };

      const url = editId ? `/api/items/${editId}` : "/api/items";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.message || "Save failed.");
        return;
      }

      setForm(emptyForm);
      setSelectedFile(null);
      setSelectedNotesheet(null);
      setSelectedPhoto(null);
      setEditId(null);
      await loadItems();

      showMessage(editId ? "Item updated successfully." : "Item saved successfully.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Something went wrong.");
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
      notesheetUrl: item.notesheetUrl || "",
      productPhotoUrl: item.productPhotoUrl || "",
      location: item.location,
      cost: item.cost,
      condition: item.condition,
      status: item.status,
      issuedTo: item.issuedTo,
      issueDate: item.issueDate,
      remarks: item.remarks,
    });

    setSelectedFile(null);
    setSelectedNotesheet(null);
    setSelectedPhoto(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteItem(id: string) {
    const ok = confirm("Delete this item permanently?");
    if (!ok) return;

    const res = await fetch(`/api/items/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await loadItems();
      showMessage("Item deleted.");
    } else {
      showMessage("Delete failed.");
    }
  }

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

          <div className="form-grid two-field-form">
            <label>
              Item Name *
              <input
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder="Table / Chair / Light"
              />
            </label>

            <label>
              Category *
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>Furniture</option>
                <option>Crockery</option>
                <option>Electrical</option>
                <option>Stationery</option>
                <option>Sports</option>
                <option>Kitchen</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Quantity *
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: Number(e.target.value) })
                }
              />
            </label>

            <label>
              Buying Date *
              <input
                type="date"
                value={form.buyDate}
                onChange={(e) => setForm({ ...form, buyDate: e.target.value })}
              />
            </label>

            <label>
              Cost *
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
              />
            </label>

            <label>
              Location
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="QM Store"
              />
            </label>

            <label>
              Voucher No *
              <input
                value={form.voucherNo}
                onChange={(e) => setForm({ ...form, voucherNo: e.target.value })}
                placeholder="CRV 112"
              />
            </label>

            <label>
              Condition *
              <select
                value={form.condition}
                onChange={(e) =>
                  setForm({
                    ...form,
                    condition: e.target.value as FormState["condition"],
                  })
                }
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Repairable</option>
                <option>Poor</option>
              </select>
            </label>

            <label>
              Status *
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as FormState["status"],
                  })
                }
              >
                <option>In Store</option>
                <option>Issued</option>
                <option>Repair</option>
                <option>Damaged</option>
              </select>
            </label>

            <label>
              Issued To
              <input
                value={form.issuedTo}
                onChange={(e) => setForm({ ...form, issuedTo: e.target.value })}
                placeholder="Name / Rank / Office / Section"
              />
            </label>

            <label>
              Issue Date
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              />
            </label>

            <label className="full">
              Voucher File *
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>

            <label className="full">
              Notesheet
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setSelectedNotesheet(e.target.files?.[0] || null)
                }
              />
            </label>

            <label className="full">
              Product Photo
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(e) => setSelectedPhoto(e.target.files?.[0] || null)}
              />
            </label>

            {form.voucherUrl && (
              <div className="full existing-file">
                <b>Current Voucher:</b>{" "}
                <a href={form.voucherUrl} target="_blank">
                  Open Voucher
                </a>
              </div>
            )}

            {form.notesheetUrl && (
              <div className="full existing-file">
                <b>Current Notesheet:</b>{" "}
                <a href={form.notesheetUrl} target="_blank">
                  Open Notesheet
                </a>
              </div>
            )}

            {form.productPhotoUrl && (
              <div className="full existing-file">
                <b>Current Product Photo:</b>
                <br />
                <img
                  src={form.productPhotoUrl}
                  alt="Current product"
                  className="product-preview"
                />
              </div>
            )}

            <label className="full">
              Remarks
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Additional notes"
              />
            </label>
          </div>

          <div className="actions">
            <button
              className="dark"
              onClick={() => {
                setForm(emptyForm);
                setEditId(null);
                setSelectedFile(null);
                setSelectedNotesheet(null);
                setSelectedPhoto(null);
              }}
            >
              Clear
            </button>

            <button onClick={saveItem}>
              {editId ? "Update Item" : "Save Item"}
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
                      <span
                        className={`badge ${item.status
                          .replaceAll(" ", "-")
                          .toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td>
                      <div className="row-buttons">
                        <button className="small" onClick={() => editItem(item)}>
                          Edit
                        </button>

                        <button
                          className="small danger"
                          onClick={() => deleteItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty">
                      No item found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {message && <div className="toast">{message}</div>}
    </section>
  );
}