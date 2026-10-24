import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file uploaded." }, { status: 400 });
    }

    const allowed = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { message: "Only PDF, JPG and PNG files are allowed." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${cleanFileName(file.name)}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      url: `/uploads/${fileName}`,
      fileName,
    });
  } catch {
    return NextResponse.json(
      { message: "Upload failed." },
      { status: 500 }
    );
  }
}