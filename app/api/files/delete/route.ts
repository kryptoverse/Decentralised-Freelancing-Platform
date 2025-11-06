import { NextResponse } from "next/server";
import { pinata } from "@/utils/config";

export async function POST(request: Request) {
  try {
    const { cid } = await request.json();
    if (!cid || typeof cid !== "string") {
      return NextResponse.json({ error: "cid is required" }, { status: 400 });
    }

    await pinata.unpin(cid);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Unpin failed:", e);
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
  }
}


