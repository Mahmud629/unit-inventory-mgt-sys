"use client";

/* eslint-disable @next/next/no-img-element -- uploaded files and local previews */

import { useEffect, useMemo, useState } from "react";
import { errorText, sendJson, uploadFile } from "@/lib/client";
import { localDate, nextInventoryNo } from "@/lib/inventory";
import {
  CATEGORIES,
  CONDITIONS,
  STATUSES,
  emptyForm,
  type FormState,
  type Item,
} from "@/lib/types";
import { Field, Modal } from "./ui";

type FileKey = "voucher" | "notesheet" | "photo";
type Errors = Partial<Record<keyof FormState | FileKey, string>>;

type Props = {
  item?: Item | null; // editing when set
  items: Item[];
  onSaved: (item: Item, created: boolean) => void;
  onClose: () => void;
};

function toForm(item: Item): FormState {
  return {
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
  };
}

// Shows the chosen image (or the current one) next to a file input.
function FilePicker({
  file,
  currentUrl,
  accept,
  onChange,
}: {
  file: File | null;
  currentUrl: string;
  accept: string;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    // Revoked below when the file changes or the form closes.
    queueMicrotask(() => setPreview(url));
    return () => {
      URL.revokeObjectURL(url);
      setPreview("");
    };
  }, [file]);

  const isImage = /\.(jpe?g|png|webp)$/i.test(currentUrl);

  return (
    <>
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {file ? (
        <div className="file-field">
          {preview && <img src={preview} alt="" />}
          <span>
            New file: <b>{file.name}</b> ({Math.ceil(file.size / 1024)} KB)
          </span>
        </div>
      ) : currentUrl ? (
        <div className="file-field">
          {isImage && <img src={currentUrl} alt="" />}
          <span>
            Current file kept.{" "}
            <a href={currentUrl} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          </span>
        </div>
      ) : null}
    </>
  );
}

export default function ItemForm({ item, items, onSaved, onClose }: Props) {
  const editing = Boolean(item);
  const [form, setForm] = useState<FormState>(() =>
    item ? toForm(item) : { ...emptyForm, buyDate: localDate() }
  );
  const [files, setFiles] = useState<Record<FileKey, File | null>>({
    voucher: null,
    notesheet: null,
    photo: null,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const nextNo = useMemo(() => nextInventoryNo(items.map((i) => i.inventoryNo)), [items]);

  const locations = useMemo(
    () => [...new Set(items.map((i) => i.location).filter(Boolean))].sort(),
    [items]
  );

  const categories = useMemo(() => {
    const extra = items.map((i) => i.category).filter((c) => !CATEGORIES.includes(c as never));
    return [...CATEGORIES, ...new Set(extra)];
  }, [items]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setFile(key: FileKey, file: File | null) {
    setFiles((f) => ({ ...f, [key]: file }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!form.itemName.trim()) e.itemName = "Enter the item name.";
    if (!Number.isInteger(form.quantity) || form.quantity < 1) e.quantity = "Whole number, at least 1.";
    if (!form.buyDate) e.buyDate = "Choose the buying date.";
    if (Number.isNaN(form.cost) || form.cost < 0) e.cost = "Enter a valid cost (0 or more).";
    if (!form.voucherNo.trim()) e.voucherNo = "Enter the voucher number.";
    if (!form.voucherUrl && !files.voucher) e.voucher = "Attach the voucher (PDF or photo).";
    if (!editing && form.status === "Issued" && !form.issuedTo.trim()) {
      e.issuedTo = "Who is it issued to?";
    }
    return e;
  }

  async function save() {
    if (busy) return;

    const found = validate();
    setErrors(found);
    setServerError("");

    if (Object.keys(found).length > 0) {
      // Bring the first problem into view.
      requestAnimationFrame(() =>
        document.querySelector(".modal .field.invalid")?.scrollIntoView({ block: "center", behavior: "smooth" })
      );
      return;
    }

    setBusy(true);

    try {
      const [voucherUrl, notesheetUrl, productPhotoUrl] = await Promise.all([
        uploadFile(files.voucher, form.voucherUrl),
        uploadFile(files.notesheet, form.notesheetUrl),
        uploadFile(files.photo, form.productPhotoUrl),
      ]);

      const payload = { ...form, voucherUrl, notesheetUrl, productPhotoUrl };
      const saved = item
        ? await sendJson<Item>(`/api/items/${item.id}`, "PUT", payload)
        : await sendJson<Item>("/api/items", "POST", payload);

      onSaved(saved, !item);
    } catch (err) {
      setServerError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      size="lg"
      title={editing ? "Edit Item" : "Add New Item"}
      subtitle={
        editing ? (
          <>
            {item!.inventoryNo} — {item!.itemName}
          </>
        ) : (
          <>
            Will be saved as <b>{nextNo}</b>
          </>
        )
      }
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          {serverError && <span className="form-error">{serverError}</span>}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save Changes" : "Save Item"}
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        <div className="form-section">Item</div>

        <Field label="Item name" required error={errors.itemName}>
          <input
            value={form.itemName}
            onChange={(e) => set("itemName", e.target.value)}
            placeholder="e.g. Office Table"
            maxLength={200}
            autoFocus
          />
        </Field>

        <Field label="Category" required>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Quantity"
          required
          error={errors.quantity}
          hint={editing ? "Increasing adds to store; decreasing takes from store." : undefined}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={Number.isNaN(form.quantity) ? "" : form.quantity}
            onChange={(e) => set("quantity", e.target.value === "" ? NaN : Number(e.target.value))}
          />
        </Field>

        <Field label="Condition" required>
          <select
            value={form.condition}
            onChange={(e) => set("condition", e.target.value as FormState["condition"])}
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>

        <div className="form-section">Purchase</div>

        <Field label="Buying date" required error={errors.buyDate}>
          <input
            type="date"
            value={form.buyDate}
            max={localDate()}
            onChange={(e) => set("buyDate", e.target.value)}
          />
        </Field>

        <Field label="Cost (৳)" required error={errors.cost}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={Number.isNaN(form.cost) ? "" : form.cost}
            onChange={(e) => set("cost", e.target.value === "" ? NaN : Number(e.target.value))}
          />
        </Field>

        <Field label="Voucher no" required error={errors.voucherNo}>
          <input
            value={form.voucherNo}
            onChange={(e) => set("voucherNo", e.target.value)}
            placeholder="e.g. CRV 112"
          />
        </Field>

        <Field label="Location">
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. QM Store"
            list="location-options"
          />
          <datalist id="location-options">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>

        {!editing && (
          <>
            <div className="form-section">Initial status</div>

            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as FormState["status"])}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>

            {form.status === "Issued" ? (
              <>
                <Field label="Issued to" required error={errors.issuedTo}>
                  <input
                    value={form.issuedTo}
                    onChange={(e) => set("issuedTo", e.target.value)}
                    placeholder="Name / Rank / Office / Section"
                  />
                </Field>
                <Field label="Issue date">
                  <input
                    type="date"
                    value={form.issueDate}
                    max={localDate()}
                    onChange={(e) => set("issueDate", e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p className="field-hint" style={{ alignSelf: "center" }}>
                Most new items start <b>In Store</b>. Issue them later from the register.
              </p>
            )}
          </>
        )}

        <div className="form-section">Documents</div>

        <Field label="Voucher file" required error={errors.voucher} className="full">
          <FilePicker
            file={files.voucher}
            currentUrl={form.voucherUrl}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(f) => setFile("voucher", f)}
          />
        </Field>

        <Field label="Notesheet" className="full">
          <FilePicker
            file={files.notesheet}
            currentUrl={form.notesheetUrl}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(f) => setFile("notesheet", f)}
          />
        </Field>

        <Field label="Product photo" className="full" hint="Large photos are resized automatically.">
          <FilePicker
            file={files.photo}
            currentUrl={form.productPhotoUrl}
            accept=".jpg,.jpeg,.png,.webp"
            onChange={(f) => setFile("photo", f)}
          />
        </Field>

        <Field label="Remarks" className="full">
          <textarea
            value={form.remarks}
            onChange={(e) => set("remarks", e.target.value)}
            placeholder="Any additional notes"
          />
        </Field>

        {/* Lets Enter submit from single-line inputs. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
