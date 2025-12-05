import { DollarSign, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentReceivedToastProps {
    jobTitle: string;
    amount: string;
    onDismiss: () => void;
    visible: boolean;
}

export function PaymentReceivedToast({
    jobTitle,
    amount,
    onDismiss,
    visible,
}: PaymentReceivedToastProps) {
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
                    <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-xl shadow-2xl p-4 space-y-3 backdrop-blur-sm">
                        {/* Header */}
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/20">
                                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    Payment Received! 💰
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Work approved for{" "}
                                    <span className="font-medium text-foreground">
                                        {jobTitle}
                                    </span>
                                </p>
                                <div className="flex items-center gap-2 mt-2 text-emerald-400 font-bold text-lg">
                                    <DollarSign className="w-5 h-5" />
                                    {amount} USDT
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <button
                            onClick={onDismiss}
                            className="w-full px-3 py-2 rounded-lg bg-surface text-sm font-medium hover:bg-surface-secondary transition"
                        >
                            Awesome!
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
