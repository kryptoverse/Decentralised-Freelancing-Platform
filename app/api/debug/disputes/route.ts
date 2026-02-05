import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
    try {
        console.log("🔍 DEBUG: Fetching ALL disputes from SUPABASE...");

        const { data: dbDisputes, error } = await supabase
            .from('disputes')
            .select('*');

        if (error) {
            console.error("DEBUG: Supabase error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            count: dbDisputes?.length || 0,
            disputes: dbDisputes,
        });
    } catch (error: any) {
        console.error("DEBUG: Error fetching disputes:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch disputes" },
            { status: 500 }
        );
    }
}
