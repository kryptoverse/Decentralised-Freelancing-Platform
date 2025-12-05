import { useState, useCallback } from "react";

interface UseManualRefreshOptions<T> {
    fetchFn: () => Promise<T>;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}

export function useManualRefresh<T>({
    fetchFn,
    onSuccess,
    onError,
}: UseManualRefreshOptions<T>) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const data = await fetchFn();
            setLastRefresh(new Date());
            onSuccess?.(data);
            return data;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
            throw err;
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchFn, onSuccess, onError]);

    return {
        refresh,
        isRefreshing,
        lastRefresh,
    };
}
