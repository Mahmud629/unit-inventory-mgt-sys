import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SESSION_COOKIE = "inventory_session";

export async function POST() {
  const res = NextResponse.json({
    message: "Logged out successfully.",
  });

  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 0,
  });

  return res;
}