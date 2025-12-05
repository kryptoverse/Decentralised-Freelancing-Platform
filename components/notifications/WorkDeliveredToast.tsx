import { CheckCircle2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface WorkDeliveredToastProps {
    jobId: string;
    jobTitle: string;
    freelancerName?: string;
    onDismiss: () => void;
    visible: boolean;
}

export function WorkDeliveredToast({
    jobId,
    jobTitle,
    freelancerName,
    onDismiss,
    visible,
}: WorkDeliveredToastProps) {
    const router = useRouter();

    const handleViewJob = () => {
        router.push(`/client/jobs/${jobId}`);
        onDismiss();
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="fixed bottom-6 right-6 z-50 max-w-md"
                >
                    <div className="bg-surface border rounded-xl shadow-2xl p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground">
                                    Work Submitted! 🎉
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {freelancerName || "Freelancer"} delivered work for{" "}
                                    <span className="font-medium text-foreground">
                                        {jobTitle}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleViewJob}
                                className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
                            >
                                Review Work
                                <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                                onClick={onDismiss}
                                className="px-3 py-2 rounded-lg bg-surface-secondary text-sm font-medium hover:bg-surface-secondary/80 transition"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
