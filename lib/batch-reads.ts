import { getContract, readContract } from "thirdweb";
import { client } from "./thirdweb-client";
import { CHAIN } from "./chains";

/**
 * Batch multiple contract reads into a single Promise.all call
 * Reduces RPC overhead and improves performance
 */

export interface BatchReadItem {
    address: string;
    method: any; // Using any to avoid thirdweb overload conflicts
    params?: any[];
}

export async function batchReadContracts(items: BatchReadItem[]): Promise<any[]> {
    const promises = items.map(async (item) => {
        const contract = getContract({
            client,
            chain: CHAIN,
            address: item.address as `0x${string}`,
        });

        return readContract({
            contract,
            method: item.method,
            params: item.params || [],
        } as any);
    });

    return Promise.all(promises);
}

/**
 * Helper to batch reads from the same contract
 */
export async function batchReadSameContract(
    contractAddress: string,
    methods: Array<{ method: any; params?: any[] }>
): Promise<any[]> {
    const contract = getContract({
        client,
        chain: CHAIN,
        address: contractAddress as `0x${string}`,
    });

    const promises = methods.map(({ method, params }) =>
        readContract({
            contract,
            method,
            params: params || [],
        } as any)
    );

    return Promise.all(promises);
}

/**
 * Type-safe batch read with result mapping
 */
export async function batchReadWithMapping<T>(
    items: BatchReadItem[],
    mapper: (results: any[]) => T
): Promise<T> {
    const results = await batchReadContracts(items);
    return mapper(results);
}
