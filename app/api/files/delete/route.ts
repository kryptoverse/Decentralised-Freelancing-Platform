import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { cid } = await request.json();
    if (!cid || typeof cid !== "string") {
      return NextResponse.json({ error: "cid is required" }, { status: 400 });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: "PINATA_JWT not configured" }, { status: 500 });
    }

    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to unpin: ${error}`);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Unpin failed:", e);
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
  }
}


