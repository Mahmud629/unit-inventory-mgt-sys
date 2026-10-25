// Inventory rules shared by the server and the browser.
import type { Allocation, Item, MovementType, Status, TransactionType } from "@/lib/types";

export const INVENTORY_PREFIX = "INV-5SIG";

export function sumAllocations(
  allocations: Allocation[] = [],
  type: Status,
  holder?: string
) {
  let total = 0;

  for (const allocation of allocations) {
    if (allocation.type !== type) continue;
    if (holder && allocation.holder !== holder) continue;
    total += Number(allocation.qty || 0);
  }

  return total;
}

export type Breakdown = Record<Status, number>;

export function getBreakdown(allocations: Allocation[] = []): Breakdown {
  return {
    "In Store": sumAllocations(allocations, "In Store"),
    Issued: sumAllocations(allocations, "Issued"),
    Repair: sumAllocations(allocations, "Repair"),
    Damaged: sumAllocations(allocations, "Damaged"),
  };
}

export function getSummaryStatus(allocations: Allocation[]): Status {
  const b = getBreakdown(allocations);

  if (b.Damaged > 0 && b["In Store"] === 0 && b.Issued === 0 && b.Repair === 0) {
    return "Damaged";
  }
  if (b.Repair > 0 && b["In Store"] === 0 && b.Issued === 0) return "Repair";
  if (b.Issued > 0 && b["In Store"] === 0 && b.Repair === 0 && b.Damaged === 0) {
    return "Issued";
  }
  return "In Store";
}

// Issued quantities grouped by holder, for the "Returned From" list.
export function getIssuedHolders(allocations: Allocation[] = []) {
  const holders = new Map<string, number>();

  for (const allocation of allocations) {
    if (allocation.type !== "Issued") continue;
    holders.set(allocation.holder, (holders.get(allocation.holder) || 0) + allocation.qty);
  }

  return [...holders.entries()].map(([holder, qty]) => ({ holder, qty }));
}

// Next number in the INV-5SIG-YYYY-NNNN series (numbering continues across years).
export function nextInventoryNo(existing: string[], year = new Date().getFullYear()) {
  let max = 0;
  const pattern = new RegExp(`^${INVENTORY_PREFIX}-\\d{4}-(\\d+)$`, "i");

  for (const value of existing) {
    const match = value.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }

  return `${INVENTORY_PREFIX}-${year}-${String(max + 1).padStart(4, "0")}`;
}

// Pre-built lowercase text used by the register search box.
export function searchText(item: Item) {
  return [
    item.inventoryNo,
    item.itemName,
    item.category,
    item.location,
    item.issuedTo,
    item.voucherNo,
    item.condition,
    item.status,
    item.remarks,
    ...item.allocations.map(
      (a) => `${a.type} ${a.holder} ${a.location} ${a.voucherNo} ${a.remarks}`
    ),
  ]
    .join(" ")
    .toLowerCase();
}

// Labels for each stock movement, shared by the register and the vouchers.
export const MOVEMENTS: Record<
  MovementType,
  { button: string; title: string; note: string; from: Status; voucher: string; holderLabel: string }
> = {
  Issue: {
    button: "Issue",
    title: "Issue Item",
    note: "Hand over items from the store to a person, office or section.",
    from: "In Store",
    voucher: "Issue Voucher",
    holderLabel: "Issued to",
  },
  Return: {
    button: "Return",
    title: "Return to Store",
    note: "Take issued items back into the store. Pick the holder, or leave it on any holder.",
    from: "Issued",
    voucher: "Receipt Voucher (Return to Store)",
    holderLabel: "Returned by",
  },
  Repair: {
    button: "Send to Repair",
    title: "Send for Repair",
    note: "Move items from the store to repair. Bring them back with Back from Repair.",
    from: "In Store",
    voucher: "Repair Voucher",
    holderLabel: "Sent to",
  },
  Repaired: {
    button: "Back from Repair",
    title: "Back from Repair",
    note: "Return repaired items to the store.",
    from: "Repair",
    voucher: "Receipt Voucher (Back from Repair)",
    holderLabel: "Received from",
  },
  Damaged: {
    button: "Mark Damaged",
    title: "Mark as Damaged",
    note: "Move unusable items out of the store into the damaged list.",
    from: "In Store",
    voucher: "Damage Report",
    holderLabel: "Reported by",
  },
};

export const VOUCHER_TITLE: Record<TransactionType, string> = {
  Purchase: "Receipt Voucher (Purchase)",
  ...Object.fromEntries(
    Object.entries(MOVEMENTS).map(([type, m]) => [type, m.voucher])
  ),
} as Record<TransactionType, string>;

// Today's date as YYYY-MM-DD in local time. (toISOString() is UTC, which is
// still "yesterday" in Bangladesh between midnight and 6 AM.)
export function localDate(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function badgeClass(value: string) {
  return `badge ${value.replaceAll(" ", "-").toLowerCase()}`;
}

export function isImageFile(url: string) {
  return /\.(jpe?g|png|webp)$/i.test(url);
}
