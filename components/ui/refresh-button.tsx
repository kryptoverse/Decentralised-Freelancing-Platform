import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
    onRefresh: () => Promise<void>;
    label?: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function RefreshButton({
    onRefresh,
    label = "Refresh",
    className,
    size = "md"
}: RefreshButtonProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            await onRefresh();
        } catch (error) {
            console.error("Refresh failed:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const sizeClasses = {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base",
    };

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    };

    return (
        <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
                "inline-flex items-center gap-2 rounded-lg border",
                "bg-surface hover:bg-surface-secondary",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                sizeClasses[size],
                className
            )}
        >
            <RefreshCw
                className={cn(
                    iconSizes[size],
                    isRefreshing && "animate-spin"
                )}
            />
            {label && <span>{isRefreshing ? "Refreshing..." : label}</span>}
        </button>
    );
}
