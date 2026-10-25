"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/client";
import { MOVEMENTS, VOUCHER_TITLE } from "@/lib/inventory";
import type { Item, MovementType, Transaction } from "@/lib/types";

const SIGNATURES: Record<Transaction["type"], [string, string, string]> = {
  Purchase: ["Received by (QM Store)", "Checked by", "Countersigned (Adjt / OC)"],
  Issue: ["Issued by (QM Store)", "Received by (Holder)", "Countersigned (Adjt / OC)"],
  Return: ["Returned by (Holder)", "Received by (QM Store)", "Countersigned (Adjt / OC)"],
  Repair: ["Sent by (QM Store)", "Received by (Repair)", "Countersigned (Adjt / OC)"],
  Repaired: ["Returned by (Repair)", "Received by (QM Store)", "Countersigned (Adjt / OC)"],
  Damaged: ["Reported by (QM Store)", "Board / Witness", "Countersigned (Adjt / OC)"],
};

function Voucher({ item, txn, copy }: { item: Item; txn: Transaction; copy: string }) {
  const holderLabel =
    txn.type === "Purchase" ? "Supplier / Source" : MOVEMENTS[txn.type as MovementType].holderLabel;

  const rows: [string, string][] = [
    ["Voucher / Note No", txn.voucherNo || (txn.type === "Purchase" ? item.voucherNo : "") || "—"],
    ["Date", txn.date || "—"],
    ["Inventory No", item.inventoryNo],
    ["Item", item.itemName],
    ["Category", item.category],
    ["Quantity", `${txn.qty} (${numberWords(txn.qty)})`],
    [holderLabel, txn.issuedTo || "—"],
    ["Remarks", txn.remarks || "—"],
  ];

  return (
    <div className="voucher">
      <div className="voucher-head">
        <Image src="/logo-mark.png" alt="5 Sig Bn UIMS" width={64} height={64} />
        <div>
          <h1>5 Signal Battalion</h1>
          <p>UIMS · Unit Inventory Management System</p>
        </div>
        <span className="copy">{copy}</span>
      </div>

      <h2 className="voucher-title">{VOUCHER_TITLE[txn.type]}</h2>

      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="signatures">
        {SIGNATURES[txn.type].map((s) => (
          <div key={s}>{s}</div>
        ))}
      </div>
    </div>
  );
}

const ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

// Quantity in words, as written on vouchers ("Twenty Five").
function numberWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${numberWords(n % 100)}` : ""}`;
  if (n < 1_000_000) {
    return `${numberWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${numberWords(n % 1000)}` : ""}`;
  }
  return String(n);
}

export default function VoucherPage() {
  const { itemId, txnId } = useParams<{ itemId: string; txnId: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Item>(`/api/items/${itemId}`)
      .then(setItem)
      .catch((err) => setError(errorText(err)));
  }, [itemId]);

  const txn = item?.transactions.find((t) => t.id === txnId);

  // Open the print dialog once the voucher is on screen.
  useEffect(() => {
    if (!txn) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [txn]);

  if (error || (item && !txn)) {
    return <div className="print-page">{error || "This transaction no longer exists."}</div>;
  }

  if (!item || !txn) return <div className="print-page">Loading voucher…</div>;

  return (
    <div className="print-page">
      <div className="print-actions no-print">
        <button type="button" className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.close()}>
          Close
        </button>
      </div>

      <Voucher item={item} txn={txn} copy="Office copy" />
      <div className="cut-line">✂ cut here</div>
      <Voucher item={item} txn={txn} copy="Holder copy" />
    </div>
  );
}
