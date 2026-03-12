export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    console.log("🚀 Spawning standalone deployUSDT script...");
    const { stdout, stderr } = await execPromise("node scripts/deployUSDTScript.js", { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });

    // Parse the output to find __RESULT
    let result = null;
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('__RESULT')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.__RESULT) {
            result = parsed.__RESULT;
          }
        } catch (e) { }
      }
    }

    if (result) {
      return NextResponse.json(result);
    } else {
      console.error("Stderr:", stderr);
      console.log("Stdout:", stdout);
      return NextResponse.json({ success: false, error: "Missing structured result from script" });
    }
  } catch (error: any) {
    console.error("❌ Exec failed:", error.message || error);

    let result = null;
    if (error.stdout) {
      const lines = error.stdout.split('\n');
      for (const line of lines) {
        if (line.includes('__RESULT')) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.__RESULT) result = parsed.__RESULT;
          } catch (e) { }
        }
      }
    }

    if (result) {
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
