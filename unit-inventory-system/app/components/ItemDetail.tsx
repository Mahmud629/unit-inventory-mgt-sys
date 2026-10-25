"use client";

/* eslint-disable @next/next/no-img-element -- uploaded files */

import { badgeClass, getBreakdown, isImageFile, MOVEMENTS } from "@/lib/inventory";
import type { Item, MovementType } from "@/lib/types";
import { Modal } from "./ui";

type Props = {
  item: Item;
  onClose: () => void;
  onMove: (type: MovementType) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: (title: string, url: string) => void;
};

const MOVE_ORDER: MovementType[] = ["Issue", "Return", "Repair", "Repaired", "Damaged"];

const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;

export default function ItemDetail({ item, onClose, onMove, onEdit, onDelete, onPreview }: Props) {
  const b = getBreakdown(item.allocations);

  const files = [
    { title: "Product Photo", url: item.productPhotoUrl },
    { title: "Voucher", url: item.voucherUrl },
    { title: "Notesheet", url: item.notesheetUrl },
  ];

  return (
    <Modal
      size="lg"
      title={item.itemName}
      subtitle={
        <>
          {item.inventoryNo} · {item.category} · <span className={badgeClass(item.status)}>{item.status}</span>
        </>
      }
      onClose={onClose}
      toolbar={
        <>
          {MOVE_ORDER.map((type) => {
            const m = MOVEMENTS[type];
            const none = b[m.from] === 0;
            return (
              <button
                key={type}
                type="button"
                className={`btn btn-sm ${type === "Issue" ? "" : "btn-dark"}`}
                onClick={() => onMove(type)}
                disabled={none}
                title={none ? `Nothing ${m.from === "In Store" ? "in store" : m.from === "Issued" ? "issued" : "in repair"}` : m.title}
              >
                {m.button}
              </button>
            );
          })}
          <span className="spacer" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={onDelete}>
            Delete
          </button>
        </>
      }
    >
      <div className="chips">
        <div className="chip">
          <span>Total</span>
          <b>{item.quantity}</b>
        </div>
        {(["In Store", "Issued", "Repair", "Damaged"] as const).map((s) => (
          <div className="chip" key={s}>
            <span>{s}</span>
            <b>{b[s]}</b>
          </div>
        ))}
      </div>

      <div className="detail-layout">
        <dl className="kv">
          <dt>Inventory no</dt>
          <dd>{item.inventoryNo}</dd>
          <dt>Buying date</dt>
          <dd>{item.buyDate || "—"}</dd>
          <dt>Cost</dt>
          <dd>{money(item.cost)}</dd>
          <dt>Voucher no</dt>
          <dd>{item.voucherNo || "—"}</dd>
          <dt>Location</dt>
          <dd>{item.location || "—"}</dd>
          <dt>Condition</dt>
          <dd>{item.condition}</dd>
          <dt>Held by</dt>
          <dd>{item.issuedTo || "Nobody (all in store)"}</dd>
          <dt>Remarks</dt>
          <dd>{item.remarks || "—"}</dd>
        </dl>

        <div className="files">
          {files.map((f) => (
            <button
              key={f.title}
              type="button"
              className="file-card"
              onClick={() => onPreview(f.title, f.url)}
              disabled={!f.url}
            >
              <span className="file-thumb">
                {f.url && isImageFile(f.url) ? (
                  <img src={f.url} alt={f.title} loading="lazy" />
                ) : (
                  <span>{f.url ? "📄" : "—"}</span>
                )}
              </span>
              {f.title}
            </button>
          ))}
        </div>
      </div>

      <section className="modal-section">
        <h3>Where it is now</h3>
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Status</th>
                <th className="num">Qty</th>
                <th>Holder</th>
                <th>Location</th>
                <th>Since</th>
                <th>Voucher / note</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {item.allocations.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className={badgeClass(a.type)}>{a.type}</span>
                  </td>
                  <td className="num">{a.qty}</td>
                  <td>{a.holder || "—"}</td>
                  <td>{a.location || "—"}</td>
                  <td className="nowrap">{a.date || "—"}</td>
                  <td>{a.voucherNo || "—"}</td>
                  <td>{a.remarks || "—"}</td>
                </tr>
              ))}
              {item.allocations.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No stock recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="modal-section">
        <h3>History</h3>
        {item.transactions.length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <ul className="history">
            {item.transactions.map((t) => (
              <li key={t.id}>
                <span className={badgeClass(t.type)}>{t.type}</span>
                <span className="meta">
                  <b>Qty {t.qty}</b> · {t.date}
                  {t.issuedTo ? ` · ${t.issuedTo}` : ""}
                  {t.voucherNo ? ` · Voucher ${t.voucherNo}` : ""}
                  {t.remarks ? ` · ${t.remarks}` : ""}
                </span>
                <a
                  className="btn btn-sm btn-ghost"
                  href={`/print/voucher/${item.id}/${t.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  Print voucher
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}
