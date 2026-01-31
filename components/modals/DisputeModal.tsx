"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface DisputeModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void>;
    loading?: boolean;
}

export default function DisputeModal({
    open,
    onClose,
    onSubmit,
    loading = false,
}: DisputeModalProps) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!reason.trim()) {
            setError("Please provide a dispute reason");
            return;
        }

        if (reason.trim().length < 10) {
            setError("Dispute reason must be at least 10 characters");
            return;
        }

        try {
            await onSubmit(reason.trim());
            setReason("");
            setError("");
        } catch (err) {
            setError("Failed to submit dispute. Please try again.");
        }
    };

    const handleClose = () => {
        if (!loading) {
            setReason("");
            setError("");
            onClose();
        }
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
            >
                <motion.div
                    className="bg-surface border border-red-500/30 p-6 rounded-2xl max-w-lg w-full shadow-xl"
                    initial={{ scale: 0.85, opacity: 0, y: 40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-red-400">Raise Dispute</h2>
                        </div>
                        <button
                            onClick={handleClose}
                            disabled={loading}
                            className="p-1 rounded-lg hover:bg-surface-secondary transition disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Warning */}
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
                        <p className="text-sm text-amber-400">
                            ⚠️ Raising a dispute will pause this job and notify the admin for
                            resolution. Please provide a clear and detailed reason.
                        </p>
                    </div>

                    {/* Textarea */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">
                            Dispute Reason <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                setError("");
                            }}
                            disabled={loading}
                            placeholder="Describe the issue in detail (minimum 10 characters)..."
                            className="w-full h-32 px-4 py-3 rounded-xl border border-border bg-surface-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 resize-none"
                            maxLength={500}
                        />
                        <div className="flex justify-between items-center mt-1">
                            <span
                                className={`text-xs ${reason.length >= 500 ? "text-red-400" : "text-muted-foreground"
                                    }`}
                            >
                                {reason.length}/500 characters
                            </span>
                            {error && <span className="text-xs text-red-400">{error}</span>}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-surface-secondary transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !reason.trim()}
                            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 font-medium"
                        >
                            {loading ? "Submitting..." : "Submit Dispute"}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
