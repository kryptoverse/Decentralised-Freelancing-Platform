
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv(filePath: string) {
    try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(absolutePath)) {
            const content = fs.readFileSync(absolutePath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) { }
}

loadEnv('.env');
loadEnv('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

if (!supabaseUrl || !supabaseKey) {
    console.log("Missing credentials.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("INSPECTING DISPUTES...");

    const { data, error } = await supabase
        .from('disputes')
        .select('*');

    if (error) {
        console.log("ERROR:", JSON.stringify(error));
        return;
    }

    console.log(`FOUND_COUNT: ${data?.length || 0}`);

    if (data && data.length > 0) {
        data.forEach(d => {
            console.log(`RECORD: id=${d.id} job_id=${d.job_id} status=${d.status} tx=${d.transaction_hash}`);
        });
    } else {
        console.log("NO_DISPUTES_FOUND");
    }
}

main();
