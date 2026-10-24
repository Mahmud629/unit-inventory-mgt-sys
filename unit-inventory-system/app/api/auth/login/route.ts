import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SESSION_COOKIE = "inventory_session";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    const validUsername = process.env.INVENTORY_USERNAME || "admin";
    const validPassword = process.env.INVENTORY_PASSWORD || "5sig@123";

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json(
        { message: "Invalid username or password." },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      message: "Login successful.",
    });

    res.cookies.set({
      name: SESSION_COOKIE,
      value: "logged-in",
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return res;
  } catch {
    return NextResponse.json(
      { message: "Login failed." },
      { status: 500 }
    );
  }
}