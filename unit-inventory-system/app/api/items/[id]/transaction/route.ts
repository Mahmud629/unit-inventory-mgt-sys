import { NextResponse } from "next/server";
import { makeId, readItems, writeItems } from "@/lib/db";
import type { Allocation, Status, TransactionType } from "@/lib/types";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

function sumAllocations(allocations: Allocation[], type: Status, holder?: string) {
  return allocations
    .filter((allocation) => {
      if (allocation.type !== type) return false;
      if (holder && allocation.holder !== holder) return false;
      return true;
    })
    .reduce((sum, allocation) => sum + Number(allocation.qty || 0), 0);
}

function reduceAllocation(
  allocations: Allocation[],
  type: Status,
  qty: number,
  holder?: string
) {
  let remaining = qty;

  const updated = allocations
    .map((allocation) => {
      if (remaining <= 0) return allocation;
      if (allocation.type !== type) return allocation;
      if (holder && allocation.holder !== holder) return allocation;

      const deduct = Math.min(allocation.qty, remaining);
      remaining -= deduct;

      return {
        ...allocation,
        qty: allocation.qty - deduct,
      };
    })
    .filter((allocation) => allocation.qty > 0);

  return {
    allocations: updated,
    success: remaining === 0,
  };
}

function addAllocation(
  allocations: Allocation[],
  itemId: string,
  type: Status,
  qty: number,
  holder: string,
  location: string,
  voucherNo: string,
  remarks: string,
  date: string
) {
  const existingIndex = allocations.findIndex(
    (allocation) =>
      allocation.type === type &&
      allocation.holder === holder &&
      allocation.location === location &&
      allocation.voucherNo === voucherNo
  );

  if (existingIndex >= 0) {
    allocations[existingIndex] = {
      ...allocations[existingIndex],
      qty: allocations[existingIndex].qty + qty,
      remarks: remarks || allocations[existingIndex].remarks,
      date,
    };

    return allocations;
  }

  allocations.push({
    id: makeId(),
    itemId,
    type,
    qty,
    holder,
    location,
    voucherNo,
    remarks,
    date,
    createdAt: new Date().toISOString(),
  });

  return allocations;
}

function getSummaryStatus(allocations: Allocation[]): Status {
  const damaged = sumAllocations(allocations, "Damaged");
  const repair = sumAllocations(allocations, "Repair");
  const issued = sumAllocations(allocations, "Issued");
  const store = sumAllocations(allocations, "In Store");

  if (damaged > 0 && store === 0 && issued === 0 && repair === 0) return "Damaged";
  if (repair > 0 && store === 0 && issued === 0) return "Repair";
  if (issued > 0 && store === 0 && repair === 0 && damaged === 0) return "Issued";
  return "In Store";
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const items = await readItems();
  const index = items.findIndex((x) => x.id === id);

  if (index === -1) {
    return NextResponse.json({ message: "Item not found." }, { status: 404 });
  }

  const item = items[index];
  const type: TransactionType = body.type;
  const qty = Number(body.qty || 0);
  const holder = String(body.issuedTo || "").trim();
  const voucherNo = String(body.voucherNo || "").trim();
  const remarks = String(body.remarks || "").trim();
  const date = body.date || new Date().toISOString().slice(0, 10);

  if (!qty || qty < 1) {
    return NextResponse.json(
      { message: "Valid quantity is required." },
      { status: 400 }
    );
  }

  let allocations = [...(item.allocations || [])];

  if (type === "Issue") {
    if (!holder) {
      return NextResponse.json(
        { message: "Issued To is required." },
        { status: 400 }
      );
    }

    const storeQty = sumAllocations(allocations, "In Store");

    if (qty > storeQty) {
      return NextResponse.json(
        { message: "Issue quantity cannot exceed In Store quantity." },
        { status: 400 }
      );
    }

    const reduced = reduceAllocation(allocations, "In Store", qty);

    if (!reduced.success) {
      return NextResponse.json(
        { message: "Unable to deduct from store." },
        { status: 400 }
      );
    }

    allocations = addAllocation(
      reduced.allocations,
      item.id,
      "Issued",
      qty,
      holder,
      item.location || "",
      voucherNo,
      remarks,
      date
    );

    item.issuedTo = holder;
    item.issueDate = date;
  }

  if (type === "Return") {
    const issuedQty = holder
      ? sumAllocations(allocations, "Issued", holder)
      : sumAllocations(allocations, "Issued");

    if (qty > issuedQty) {
      return NextResponse.json(
        { message: "Return quantity cannot exceed issued quantity." },
        { status: 400 }
      );
    }

    const reduced = reduceAllocation(
      allocations,
      "Issued",
      qty,
      holder || undefined
    );

    if (!reduced.success) {
      return NextResponse.json(
        { message: "Unable to return this quantity." },
        { status: 400 }
      );
    }

    allocations = addAllocation(
      reduced.allocations,
      item.id,
      "In Store",
      qty,
      "QM Store",
      item.location || "QM Store",
      voucherNo,
      remarks || `Returned${holder ? ` from ${holder}` : ""}`,
      date
    );
  }

  if (type === "Repair") {
    const storeQty = sumAllocations(allocations, "In Store");

    if (qty > storeQty) {
      return NextResponse.json(
        { message: "Repair quantity cannot exceed In Store quantity." },
        { status: 400 }
      );
    }

    const reduced = reduceAllocation(allocations, "In Store", qty);

    if (!reduced.success) {
      return NextResponse.json(
        { message: "Unable to send this quantity to repair." },
        { status: 400 }
      );
    }

    allocations = addAllocation(
      reduced.allocations,
      item.id,
      "Repair",
      qty,
      "Repair Store",
      "Repair Store",
      voucherNo,
      remarks,
      date
    );

    item.condition = "Repairable";
  }

  if (type === "Damaged") {
    const storeQty = sumAllocations(allocations, "In Store");

    if (qty > storeQty) {
      return NextResponse.json(
        { message: "Damaged quantity cannot exceed In Store quantity." },
        { status: 400 }
      );
    }

    const reduced = reduceAllocation(allocations, "In Store", qty);

    if (!reduced.success) {
      return NextResponse.json(
        { message: "Unable to mark this quantity as damaged." },
        { status: 400 }
      );
    }

    allocations = addAllocation(
      reduced.allocations,
      item.id,
      "Damaged",
      qty,
      "Damaged Store",
      "Damaged Store",
      voucherNo,
      remarks,
      date
    );

    item.condition = "Poor";
  }

  const availableQty = sumAllocations(allocations, "In Store");
  const issuedQty = sumAllocations(allocations, "Issued");

  item.availableQty = availableQty;
  item.issuedQty = issuedQty;
  item.status = getSummaryStatus(allocations);
  item.allocations = allocations;

  item.transactions.unshift({
    id: makeId(),
    type,
    qty,
    issuedTo: holder,
    voucherNo,
    voucherUrl: "",
    remarks,
    date,
    createdAt: new Date().toISOString(),
  });

  item.updatedAt = new Date().toISOString();

  items[index] = item;

  await writeItems(items);

  return NextResponse.json(item);
}