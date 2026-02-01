import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const session = req.cookies.get("admin_session");

    if (session?.value === "authenticated") {
        return NextResponse.json({ authenticated: true });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
}
