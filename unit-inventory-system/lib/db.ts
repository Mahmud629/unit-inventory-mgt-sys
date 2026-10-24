import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  Allocation,
  Condition,
  Status,
  TransactionType,
} from "@/lib/types";

export type Transaction = {
  id: string;
  type: TransactionType;
  qty: number;
  issuedTo?: string;
  voucherNo?: string;
  voucherUrl?: string;
  remarks?: string;
  date: string;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  inventoryNo: string;
  itemName: string;
  category: string;
  quantity: number;
  availableQty: number;
  issuedQty: number;
  issuedTo: string;
  issueDate: string;
  buyDate: string;
  voucherNo: string;
  voucherUrl: string;
  notesheetUrl: string;
  productPhotoUrl: string;
  location: string;
  cost: number;
  condition: Condition;
  status: Status;
  remarks: string;
  allocations: Allocation[];
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "inventory.db");

let dbInstance: Database.Database | null = null;

function now() {
  return new Date().toISOString();
}

export function makeId() {
  return globalThis.crypto.randomUUID();
}

function makeSafeStatus(value: string): Status {
  if (value === "In Store") return "In Store";
  if (value === "Issued") return "Issued";
  if (value === "Repair") return "Repair";
  if (value === "Damaged") return "Damaged";
  return "In Store";
}

function makeSafeCondition(value: string): Condition {
  if (value === "Excellent") return "Excellent";
  if (value === "Good") return "Good";
  if (value === "Repairable") return "Repairable";
  if (value === "Poor") return "Poor";
  if (value === "Serviceable") return "Repairable";
  return "Good";
}

function makeSafeTransactionType(value: string): TransactionType {
  if (value === "Purchase") return "Purchase";
  if (value === "Issue") return "Issue";
  if (value === "Return") return "Return";
  if (value === "Repair") return "Repair";
  if (value === "Damaged") return "Damaged";
  return "Purchase";
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function columnExists(db: Database.Database, tableName: string, columnName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
    name: string;
  }[];

  return columns.some((column) => column.name === columnName);
}

function getDb() {
  if (dbInstance) return dbInstance;

  ensureDataDir();

  const db = new Database(DB_FILE);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      inventory_no TEXT UNIQUE NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      available_qty INTEGER NOT NULL,
      issued_qty INTEGER NOT NULL,
      issued_to TEXT,
      issue_date TEXT,
      buy_date TEXT,
      voucher_no TEXT,
      voucher_url TEXT,
      product_photo_url TEXT,
      location TEXT,
      cost REAL,
      condition TEXT NOT NULL,
      status TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      qty INTEGER NOT NULL,
      issued_to TEXT,
      voucher_no TEXT,
      voucher_url TEXT,
      remarks TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_allocations (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      qty INTEGER NOT NULL,
      holder TEXT,
      location TEXT,
      voucher_no TEXT,
      remarks TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_no
    ON inventory_items(inventory_no);

    CREATE INDEX IF NOT EXISTS idx_inventory_items_item_name
    ON inventory_items(item_name);

    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id
    ON inventory_transactions(item_id);

    CREATE INDEX IF NOT EXISTS idx_inventory_allocations_item_id
    ON inventory_allocations(item_id);
  `);

  if (!columnExists(db, "inventory_items", "notesheet_url")) {
    db.exec(`ALTER TABLE inventory_items ADD COLUMN notesheet_url TEXT DEFAULT ''`);
  }

  dbInstance = db;

  return dbInstance;
}

function sumAllocations(allocations: Allocation[], type: Status) {
  return allocations
    .filter((allocation) => allocation.type === type)
    .reduce((sum, allocation) => sum + Number(allocation.qty || 0), 0);
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

function normalizeAllocations(item: InventoryItem): Allocation[] {
  if (Array.isArray(item.allocations) && item.allocations.length > 0) {
    return item.allocations.filter((allocation) => Number(allocation.qty) > 0);
  }

  const allocations: Allocation[] = [];

  if (item.availableQty > 0) {
    allocations.push({
      id: makeId(),
      itemId: item.id,
      type: "In Store",
      qty: item.availableQty,
      holder: "QM Store",
      location: item.location || "QM Store",
      voucherNo: item.voucherNo || "",
      remarks: "Auto-created store balance",
      date: item.buyDate || now().slice(0, 10),
      createdAt: now(),
    });
  }

  if (item.issuedQty > 0) {
    allocations.push({
      id: makeId(),
      itemId: item.id,
      type: "Issued",
      qty: item.issuedQty,
      holder: item.issuedTo || "Issued Holder",
      location: item.location || "",
      voucherNo: "",
      remarks: "Auto-created issued balance",
      date: item.issueDate || now().slice(0, 10),
      createdAt: now(),
    });
  }

  if (allocations.length === 0 && item.quantity > 0) {
    allocations.push({
      id: makeId(),
      itemId: item.id,
      type: item.status,
      qty: item.quantity,
      holder: item.status === "In Store" ? "QM Store" : item.issuedTo || item.status,
      location: item.location || "",
      voucherNo: item.voucherNo || "",
      remarks: "Auto-created balance",
      date: item.buyDate || now().slice(0, 10),
      createdAt: now(),
    });
  }

  return allocations;
}

function insertItemOnly(item: InventoryItem) {
  const db = getDb();
  const allocations = normalizeAllocations(item);
  const availableQty = sumAllocations(allocations, "In Store");
  const issuedQty = sumAllocations(allocations, "Issued");
  const status = getSummaryStatus(allocations);

  db.prepare(`
    INSERT INTO inventory_items (
      id,
      inventory_no,
      item_name,
      category,
      quantity,
      available_qty,
      issued_qty,
      issued_to,
      issue_date,
      buy_date,
      voucher_no,
      voucher_url,
      notesheet_url,
      product_photo_url,
      location,
      cost,
      condition,
      status,
      remarks,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @inventoryNo,
      @itemName,
      @category,
      @quantity,
      @availableQty,
      @issuedQty,
      @issuedTo,
      @issueDate,
      @buyDate,
      @voucherNo,
      @voucherUrl,
      @notesheetUrl,
      @productPhotoUrl,
      @location,
      @cost,
      @condition,
      @status,
      @remarks,
      @createdAt,
      @updatedAt
    )
  `).run({
    ...item,
    availableQty,
    issuedQty,
    status,
    notesheetUrl: item.notesheetUrl || "",
  });
}

function insertTransactionOnly(itemId: string, txn: Transaction) {
  const db = getDb();

  db.prepare(`
    INSERT INTO inventory_transactions (
      id,
      item_id,
      type,
      qty,
      issued_to,
      voucher_no,
      voucher_url,
      remarks,
      date,
      created_at
    ) VALUES (
      @id,
      @itemId,
      @type,
      @qty,
      @issuedTo,
      @voucherNo,
      @voucherUrl,
      @remarks,
      @date,
      @createdAt
    )
  `).run({
    id: txn.id,
    itemId,
    type: txn.type,
    qty: txn.qty,
    issuedTo: txn.issuedTo || "",
    voucherNo: txn.voucherNo || "",
    voucherUrl: txn.voucherUrl || "",
    remarks: txn.remarks || "",
    date: txn.date,
    createdAt: txn.createdAt,
  });
}

function insertAllocationOnly(allocation: Allocation) {
  const db = getDb();

  db.prepare(`
    INSERT INTO inventory_allocations (
      id,
      item_id,
      type,
      qty,
      holder,
      location,
      voucher_no,
      remarks,
      date,
      created_at
    ) VALUES (
      @id,
      @itemId,
      @type,
      @qty,
      @holder,
      @location,
      @voucherNo,
      @remarks,
      @date,
      @createdAt
    )
  `).run({
    id: allocation.id,
    itemId: allocation.itemId,
    type: allocation.type,
    qty: allocation.qty,
    holder: allocation.holder || "",
    location: allocation.location || "",
    voucherNo: allocation.voucherNo || "",
    remarks: allocation.remarks || "",
    date: allocation.date,
    createdAt: allocation.createdAt,
  });
}

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    type: makeSafeTransactionType(String(row.type || "Purchase")),
    qty: Number(row.qty || 0),
    issuedTo: String(row.issued_to || ""),
    voucherNo: String(row.voucher_no || ""),
    voucherUrl: String(row.voucher_url || ""),
    remarks: String(row.remarks || ""),
    date: String(row.date || ""),
    createdAt: String(row.created_at || ""),
  };
}

function rowToAllocation(row: Record<string, unknown>): Allocation {
  return {
    id: String(row.id),
    itemId: String(row.item_id || ""),
    type: makeSafeStatus(String(row.type || "In Store")),
    qty: Number(row.qty || 0),
    holder: String(row.holder || ""),
    location: String(row.location || ""),
    voucherNo: String(row.voucher_no || ""),
    remarks: String(row.remarks || ""),
    date: String(row.date || ""),
    createdAt: String(row.created_at || ""),
  };
}

function rowToItem(
  row: Record<string, unknown>,
  transactions: Transaction[],
  allocations: Allocation[]
): InventoryItem {
  const availableQty = sumAllocations(allocations, "In Store");
  const issuedQty = sumAllocations(allocations, "Issued");
  const status = getSummaryStatus(allocations);

  return {
    id: String(row.id),
    inventoryNo: String(row.inventory_no || ""),
    itemName: String(row.item_name || ""),
    category: String(row.category || "Other"),
    quantity: Number(row.quantity || 0),
    availableQty,
    issuedQty,
    issuedTo: String(row.issued_to || ""),
    issueDate: String(row.issue_date || ""),
    buyDate: String(row.buy_date || ""),
    voucherNo: String(row.voucher_no || ""),
    voucherUrl: String(row.voucher_url || ""),
    notesheetUrl: String(row.notesheet_url || ""),
    productPhotoUrl: String(row.product_photo_url || ""),
    location: String(row.location || ""),
    cost: Number(row.cost || 0),
    condition: makeSafeCondition(String(row.condition || "Good")),
    status,
    remarks: String(row.remarks || ""),
    allocations,
    transactions,
    createdAt: String(row.created_at || now()),
    updatedAt: String(row.updated_at || now()),
  };
}

export async function readItems(): Promise<InventoryItem[]> {
  const db = getDb();

  const itemRows = db
    .prepare(
      `
      SELECT *
      FROM inventory_items
      ORDER BY datetime(created_at) DESC
    `
    )
    .all() as Record<string, unknown>[];

  const txnStmt = db.prepare(`
    SELECT *
    FROM inventory_transactions
    WHERE item_id = ?
    ORDER BY datetime(created_at) DESC
  `);

  const allocationStmt = db.prepare(`
    SELECT *
    FROM inventory_allocations
    WHERE item_id = ?
    ORDER BY datetime(created_at) ASC
  `);

  const items = itemRows.map((row) => {
    const itemId = String(row.id);

    const txnRows = txnStmt.all(itemId) as Record<string, unknown>[];
    const transactions = txnRows.map(rowToTransaction);

    const allocationRows = allocationStmt.all(itemId) as Record<string, unknown>[];
    let allocations = allocationRows.map(rowToAllocation);

    if (allocations.length === 0) {
      const tempItem = rowToItem(row, transactions, []);
      allocations = normalizeAllocations(tempItem);
    }

    return rowToItem(row, transactions, allocations);
  });

  const needsAllocationSave = items.some((item) => {
    const rows = allocationStmt.all(item.id) as Record<string, unknown>[];
    return rows.length === 0 && item.allocations.length > 0;
  });

  if (needsAllocationSave) {
    await writeItems(items);
  }

  return items;
}

export async function writeItems(items: InventoryItem[]) {
  const db = getDb();

  const replaceAll = db.transaction((safeItems: InventoryItem[]) => {
    db.prepare(`DELETE FROM inventory_allocations`).run();
    db.prepare(`DELETE FROM inventory_transactions`).run();
    db.prepare(`DELETE FROM inventory_items`).run();

    for (const item of safeItems) {
      const safeItem: InventoryItem = {
        ...item,
        notesheetUrl: item.notesheetUrl || "",
        allocations: normalizeAllocations(item),
      };

      insertItemOnly(safeItem);

      for (const allocation of safeItem.allocations || []) {
        if (Number(allocation.qty) > 0) {
          insertAllocationOnly({
            ...allocation,
            itemId: safeItem.id,
          });
        }
      }

      for (const txn of safeItem.transactions || []) {
        insertTransactionOnly(safeItem.id, txn);
      }
    }
  });

  replaceAll(items);
}