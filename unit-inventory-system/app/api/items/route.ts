import { NextResponse } from "next/server";
import { makeId, readItems, writeItems, type InventoryItem } from "@/lib/db";
import type { Allocation, Status } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const items = await readItems();
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = await readItems();

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

    const quantity = Number(body.quantity);
    const cost = Number(body.cost);

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { message: "Quantity must be at least 1." },
        { status: 400 }
      );
    }

    if (Number.isNaN(cost) || cost < 0) {
      return NextResponse.json(
        { message: "Valid cost is required." },
        { status: 400 }
      );
    }

    const duplicate = items.find(
      (x) =>
        x.inventoryNo.toLowerCase() === String(body.inventoryNo).toLowerCase()
    );

    if (duplicate) {
      return NextResponse.json(
        { message: "This inventory number already exists." },
        { status: 409 }
      );
    }

    const statusValue: Status = body.status || "In Store";
    const itemId = makeId();

    const initialAllocation: Allocation = {
      id: makeId(),
      itemId,
      type: statusValue,
      qty: quantity,
      holder:
        statusValue === "Issued"
          ? body.issuedTo || "Issued Holder"
          : statusValue === "In Store"
          ? "QM Store"
          : statusValue,
      location: body.location || "",
      voucherNo: body.voucherNo,
      remarks: "Initial accountability entry",
      date: body.buyDate,
      createdAt: new Date().toISOString(),
    };

    const newItem: InventoryItem = {
      id: itemId,
      inventoryNo: body.inventoryNo,
      itemName: body.itemName,
      category: body.category,
      quantity,
      availableQty: statusValue === "In Store" ? quantity : 0,
      issuedQty: statusValue === "Issued" ? quantity : 0,
      issuedTo: body.issuedTo || "",
      issueDate: body.issueDate || "",
      buyDate: body.buyDate,
      voucherNo: body.voucherNo,
      voucherUrl: body.voucherUrl,
      notesheetUrl: body.notesheetUrl || "",
      productPhotoUrl: body.productPhotoUrl || "",
      location: body.location || "",
      cost,
      condition: body.condition,
      status: statusValue,
      remarks: body.remarks || "",
      allocations: [initialAllocation],
      transactions: [
        {
          id: makeId(),
          type: "Purchase",
          qty: quantity,
          voucherNo: body.voucherNo,
          voucherUrl: body.voucherUrl,
          remarks: "Initial purchase entry",
          date: body.buyDate,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    items.unshift(newItem);
    await writeItems(items);

    return NextResponse.json(newItem, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Failed to save item." },
      { status: 500 }
    );
  }
}