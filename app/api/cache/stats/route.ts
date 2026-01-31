import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/blockchain-cache';

/**
 * GET /api/cache/stats
 * 
 * Get cache statistics and health check
 * Useful for debugging and monitoring
 */
export async function GET(req: NextRequest) {
    try {
        const stats = await getCacheStats();

        return NextResponse.json({
            success: true,
            cache: stats,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[API Error] /api/cache/stats:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch cache stats',
                details: error.message
            },
            { status: 500 }
        );
    }
}
