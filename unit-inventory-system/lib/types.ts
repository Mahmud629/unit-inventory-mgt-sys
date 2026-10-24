export type Status = "In Store" | "Issued" | "Repair" | "Damaged";

export type Condition = "Excellent" | "Good" | "Repairable" | "Poor";

export type TransactionType =
  | "Purchase"
  | "Issue"
  | "Return"
  | "Repair"
  | "Damaged";

export type Allocation = {
  id: string;
  itemId: string;
  type: Status;
  qty: number;
  holder: string;
  location: string;
  voucherNo: string;
  remarks: string;
  date: string;
  createdAt: string;
};

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

export type Item = {
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

export const emptyForm = {
  inventoryNo: "",
  itemName: "",
  category: "Furniture",
  quantity: 1,
  buyDate: "",
  voucherNo: "",
  voucherUrl: "",
  notesheetUrl: "",
  productPhotoUrl: "",
  location: "",
  cost: 0,
  condition: "Good" as Condition,
  status: "In Store" as Status,
  issuedTo: "",
  issueDate: "",
  remarks: "",
};

export type FormState = typeof emptyForm;