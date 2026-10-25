"use client";

import { useState } from "react";
import { errorText, sendJson } from "@/lib/client";
import { getBreakdown, getIssuedHolders, localDate, MOVEMENTS } from "@/lib/inventory";
import type { Item, MovementType } from "@/lib/types";
import { Field, Modal } from "./ui";

type Props = {
  item: Item;
  type: MovementType;
  holders: string[]; // known holder names, for suggestions
  onDone: (item: Item) => void;
  onClose: () => void;
};

export default function MovementForm({ item, type, holders, onDone, onClose }: Props) {
  const move = MOVEMENTS[type];
  const breakdown = getBreakdown(item.allocations);
  const issuedHolders = getIssuedHolders(item.allocations);

  const [qty, setQty] = useState(1);
  const [holder, setHolder] = useState("");
  const [date, setDate] = useState(localDate());
  const [voucherNo, setVoucherNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const available =
    type === "Return" && holder
      ? issuedHolders.find((h) => h.holder === holder)?.qty || 0
      : breakdown[move.from];

  async function submit() {
    if (busy) return;

    if (!Number.isInteger(qty) || qty < 1) return setError("Enter a whole quantity of at least 1.");
    if (qty > available) return setError(`Only ${available} available.`);
    if (type === "Issue" && !holder.trim()) return setError("Enter who it is issued to.");

    setBusy(true);
    setError("");

    try {
      const updated = await sendJson<Item>(`/api/items/${item.id}/transaction`, "POST", {
        type,
        qty,
        issuedTo: holder.trim(),
        date,
        voucherNo,
        remarks,
      });
      onDone(updated);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      title={move.title}
      subtitle={`${item.inventoryNo} — ${item.itemName}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          {error && <span className="form-error">{error}</span>}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submit} disabled={busy || available === 0}>
            {busy ? "Saving…" : `Confirm ${move.button}`}
          </button>
        </>
      }
    >
      <div className="chips chips-4">
        {(["In Store", "Issued", "Repair", "Damaged"] as const).map((s) => (
          <div className="chip" key={s} style={s === move.from ? { borderColor: "var(--sky)" } : undefined}>
            <span>{s}</span>
            <b>{breakdown[s]}</b>
          </div>
        ))}
      </div>

      <p className="note" style={{ margin: "14px 0" }}>
        {move.note}
      </p>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        {type === "Issue" && (
          <Field label="Issued to" required className="full" hint="Name / rank / office / section">
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              list="holder-options"
              placeholder="e.g. Snk Asif / Coy Office"
              autoFocus
            />
            <datalist id="holder-options">
              {holders.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          </Field>
        )}

        {type === "Return" && (
          <Field label="Returned from" className="full">
            <select value={holder} onChange={(e) => setHolder(e.target.value)} autoFocus>
              <option value="">Any holder ({breakdown.Issued} issued)</option>
              {issuedHolders.map((h) => (
                <option key={h.holder} value={h.holder}>
                  {h.holder} — holds {h.qty}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={`Quantity (max ${available})`} required>
          <div className="input-row">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={available}
              value={Number.isNaN(qty) ? "" : qty}
              onChange={(e) => setQty(e.target.value === "" ? NaN : Number(e.target.value))}
              autoFocus={type !== "Issue" && type !== "Return"}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setQty(available)}
              disabled={available === 0}
            >
              All
            </button>
          </div>
        </Field>

        <Field label="Date">
          <input type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Voucher / note no" className="full">
          <input
            value={voucherNo}
            onChange={(e) => setVoucherNo(e.target.value)}
            placeholder="Issue voucher / return note / repair note"
          />
        </Field>

        <Field label="Remarks" className="full">
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
        </Field>

        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
