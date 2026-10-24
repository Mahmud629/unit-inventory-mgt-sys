import { NextResponse } from "next/server";
import { makeId, readItems, writeItems } from "@/lib/db";
import type { Allocation } from "@/lib/types";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

function sumAllocations(allocations: Allocation[], type: string) {
  return allocations
    .filter((allocation) => allocation.type === type)
    .reduce((sum, allocation) => sum + Number(allocation.qty || 0), 0);
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const items = await readItems();
  const item = items.find((x) => x.id === id);

  if (!item) {
    return NextResponse.json({ message: "Item not found." }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const items = await readItems();

  const index = items.findIndex((x) => x.id === id);

  if (index === -1) {
    return NextResponse.json({ message: "Item not found." }, { status: 404 });
  }

  const requiredFields = [
    ["itemName", "Item Name"],
    ["category", "Category"],
    ["quantity", "Quantity"],
    ["buyDate", "Buying Date"],
    ["cost", "Cost"],
    ["voucherNo", "Voucher No"],
    ["condition", "Condition"],
    ["status", "Status"],
    ["voucherUrl", "Voucher File"],
  ];

  for (const [key, label] of requiredFields) {
    if (
      body[key] === undefined ||
      body[key] === null ||
      String(body[key]).trim() === ""
    ) {
      return NextResponse.json(
        { message: `${label} is required.` },
        { status: 400 }
      );
    }
  }

  const duplicate = items.find(
    (x) =>
      x.id !== id &&
      x.inventoryNo.toLowerCase() === String(body.inventoryNo).toLowerCase()
  );

  if (duplicate) {
    return NextResponse.json(
      { message: "This inventory number already exists." },
      { status: 409 }
    );
  }

  const oldItem = items[index];
  const newQuantity = Number(body.quantity || oldItem.quantity);
  const oldQuantity = Number(oldItem.quantity || 0);
  const difference = newQuantity - oldQuantity;

  let allocations = [...(oldItem.allocations || [])];

  if (difference > 0) {
    allocations.push({
      id: makeId(),
      itemId: oldItem.id,
      type: "In Store",
      qty: difference,
      holder: "QM Store",
      location: body.location || oldItem.location || "QM Store",
      voucherNo: body.voucherNo || "",
      remarks: "Quantity increased during edit",
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });
  }

  if (difference < 0) {
    const reduceQty = Math.abs(difference);
    const storeQty = sumAllocations(allocations, "In Store");

    if (reduceQty > storeQty) {
      return NextResponse.json(
        {
          message:
            "Cannot reduce quantity because sufficient In Store quantity is not available.",
        },
        { status: 400 }
      );
    }

    let remaining = reduceQty;

    allocations = allocations
      .map((allocation) => {
        if (allocation.type !== "In Store" || remaining <= 0) return allocation;

        const deduct = Math.min(allocation.qty, remaining);
        remaining -= deduct;

        return {
          ...allocation,
          qty: allocation.qty - deduct,
        };
      })
      .filter((allocation) => allocation.qty > 0);
  }

  const availableQty = sumAllocations(allocations, "In Store");
  const issuedQty = sumAllocations(allocations, "Issued");

  items[index] = {
    ...oldItem,
    inventoryNo: body.inventoryNo,
    itemName: body.itemName,
    category: body.category,
    quantity: newQuantity,
    availableQty,
    issuedQty,
    buyDate: body.buyDate,
    voucherNo: body.voucherNo,
    voucherUrl: body.voucherUrl,
    notesheetUrl: body.notesheetUrl || oldItem.notesheetUrl || "",
    productPhotoUrl: body.productPhotoUrl || oldItem.productPhotoUrl || "",
    issuedTo: body.issuedTo || "",
    issueDate: body.issueDate || "",
    location: body.location || "",
    cost: Number(body.cost || 0),
    condition: body.condition,
    status: body.status,
    remarks: body.remarks || "",
    allocations,
    updatedAt: new Date().toISOString(),
  };

  await writeItems(items);

  return NextResponse.json(items[index]);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const items = await readItems();

  const updated = items.filter((x) => x.id !== id);

  if (updated.length === items.length) {
    return NextResponse.json({ message: "Item not found." }, { status: 404 });
  }

  await writeItems(updated);

  return NextResponse.json({ message: "Item deleted." });
}