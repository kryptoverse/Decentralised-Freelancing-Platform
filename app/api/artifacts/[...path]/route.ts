import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join("/");
    const fullPath = path.join(process.cwd(), "artifacts", filePath);

    // Security: Ensure path is within artifacts directory
    const artifactsDir = path.join(process.cwd(), "artifacts");
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(artifactsDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileContent = fs.readFileSync(fullPath, "utf8");
    const json = JSON.parse(fileContent);

    return NextResponse.json(json, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("Error serving artifact:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

