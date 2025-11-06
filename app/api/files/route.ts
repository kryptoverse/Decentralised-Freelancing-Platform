import { NextResponse, type NextRequest } from "next/server";
import { pinata } from "@/utils/config";

export async function POST(request: NextRequest) {
  try {
    // If JSON metadata
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();

      // Support both raw metadata and { data, name, previousCid }
      const data = body?.data ?? body;
      let name = body?.name as string | undefined;
      const previousCid = body?.previousCid as string | undefined;

      // ✅ Ensure metadata JSON has .json extension
      if (name && !name.endsWith('.json')) {
        name = `${name}.json`;
      }

      // ✅ Fallback: generate descriptive name if not provided
      if (!name) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        name = `profile-metadata_${timestamp}.json`;
      }

      if (previousCid) {
        try {
          await pinata.unpin(previousCid);
        } catch (e) {
          console.warn("Unpin previousCid failed (continuing):", e);
        }
      }

      // ✅ Pinata SDK expects name in options object
      const uploadOptions = { name };
      const { cid } = await pinata.upload.public.json(data, uploadOptions);
      const url = await pinata.gateways.public.convert(cid);
      return NextResponse.json({ cid, url }, { status: 200 });
    }

    // Otherwise expect multipart/form-data with a "file" field
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    let name = (form.get("name") as string) || undefined;
    const previousCid = (form.get("previousCid") as string) || undefined;

    // ✅ Ensure name includes file extension if not already present
    if (name && file.name) {
      const originalExt = file.name.split('.').pop();
      if (originalExt && !name.includes('.')) {
        name = `${name}.${originalExt}`;
      }
    }

    // ✅ Fallback: use wallet prefix + original filename if no name provided
    if (!name && file.name) {
      const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      name = `file_${Date.now()}_${sanitized}`;
    }

    if (previousCid) {
      try {
        await pinata.unpin(previousCid);
      } catch (e) {
        console.warn("Unpin previousCid failed (continuing):", e);
      }
    }

    // ✅ Pinata SDK expects name in options object
    const uploadOptions = name ? { name } : undefined;
    const { cid } = await pinata.upload.public.file(file, uploadOptions as any);
    const url = await pinata.gateways.public.convert(cid);

    return NextResponse.json({ cid, url }, { status: 200 });
  } catch (e) {
    console.error("Upload failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
