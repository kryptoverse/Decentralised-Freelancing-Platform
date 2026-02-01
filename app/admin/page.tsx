"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Server,
  Rocket,
  Copy,
  Scale,
  FileText,
  User,
  DollarSign,
  ExternalLink,
} from "lucide-react";

interface Freelancer {
  address: string;
  profileAddress: string | null;
  name: string;
  isKYCVerified: boolean;
}

interface Dispute {
  jobId: number;
  jobTitle: string;
  escrowAddress: string;
  client: string;
  clientName: string;
  freelancer: string;
  freelancerName: string;
  budget: number;
  disputeReason: string;
  jobDescription: string;
  lastDeliveryURI: string;
  lastDisputeURI: string;
  createdAt: number;
}

export default function AdminPage() {
  // KYC Management State
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingKYC, setProcessingKYC] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Contract Deployment State
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deployed, setDeployed] = useState<Record<string, string>>({});
  const [walletUsed, setWalletUsed] = useState<string>("");

  // Disputes State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolvingDispute, setResolvingDispute] = useState(false);

  const fetchFreelancers = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/freelancers");
      const data = await res.json();

      if (data.success) {
        setFreelancers(data.freelancers);
      } else {
        setError(data.error || "Failed to fetch freelancers");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch freelancers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFreelancers();
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoadingDisputes(true);
      const res = await fetch("/api/admin/disputes");
      const data = await res.json();

      if (data.success) {
        setDisputes(data.disputes);
      }
    } catch (err: any) {
      console.error("Failed to fetch disputes:", err);
    } finally {
      setLoadingDisputes(false);
    }
  };

  const handleKYCAction = async (address: string, approve: boolean) => {
    try {
      setProcessingKYC(address);
      setNotification(null);

      const res = await fetch("/api/admin/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerAddress: address,
          approve,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification({
          type: "success",
          message: data.message,
        });

        setFreelancers((prev) =>
          prev.map((f) =>
            f.address === address ? { ...f, isKYCVerified: approve } : f
          )
        );

        setTimeout(() => setNotification(null), 5000);
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to update KYC status",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to update KYC status",
      });
    } finally {
      setProcessingKYC(null);
    }
  };

  const handleDeployAll = async () => {
    try {
      setDeploying(true);
      setLogs(["🚀 Starting deployment..."]);
      setDeployed({});
      setWalletUsed("");

      const res = await fetch("/api/deployAll", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setWalletUsed(data.walletAddress);
        setLogs(data.logs);
        setDeployed(data.deployed);
      } else {
        setLogs((prev) => [...prev, "❌ Error: " + data.error]);
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, "❌ Error: " + err.message]);
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployUSDTOnly = async () => {
    try {
      setDeploying(true);
      setLogs(["🚀 Deploying TestUSDT on Polygon Amoy..."]);
      setDeployed({});
      setWalletUsed("");

      const res = await fetch("/api/deployUSDT", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setWalletUsed(data.walletAddress);
        setLogs(data.logs);
        setDeployed({
          TestUSDT: data.usdtAddress,
        });
      } else {
        setLogs((prev) => [...prev, "❌ Error: " + data.error]);
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, "❌ Error: " + err.message]);
    } finally {
      setDeploying(false);
    }
  };

  const handleResolveDispute = async (outcome: string, payoutBps: number, rating: number) => {
    if (!selectedDispute) return;

    try {
      setResolvingDispute(true);

      const res = await fetch("/api/admin/resolve-dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrowAddress: selectedDispute.escrowAddress,
          outcome,
          payoutBps,
          rating,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification({
          type: "success",
          message: "Dispute resolved successfully!",
        });
        setSelectedDispute(null);
        // Refresh disputes
        fetchDisputes();
        setTimeout(() => setNotification(null), 5000);
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to resolve dispute",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to resolve dispute",
      });
    } finally {
      setResolvingDispute(false);
    }
  };

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin123") {
      setIsAuthenticated(true);
    } else {
      alert("Invalid credentials");
    }
  };

  if (!isAuthenticated) {
    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

    return (
      <main className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-8 border border-border rounded-xl bg-surface-secondary/50 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Admin Access</h1>
          <p className="text-sm text-center text-muted-foreground mb-8">
            Please enter your credentials to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition mt-2"
            >
              Login
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="w-8 h-8 text-primary" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage contracts, KYC verification, and system configuration
        </p>
      </div>

      {/* Contract Deployment Section */}
      <section className="border border-border rounded-xl p-6 glass-effect space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          Contract Deployment
        </h2>

        <div className="flex flex-wrap gap-3">
          <button
            disabled={deploying}
            onClick={handleDeployAll}
            className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
          >
            {deploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Deploying...
              </>
            ) : (
              "Deploy & Configure All Contracts"
            )}
          </button>

          <button
            disabled={deploying}
            onClick={handleDeployUSDTOnly}
            className="px-5 py-3 bg-green-600 text-white rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
          >
            {deploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Deploying TestUSDT...
              </>
            ) : (
              "Deploy TestUSDT Only (Polygon Amoy)"
            )}
          </button>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          🧾 Using Server Wallet:
          <span className="font-mono text-primary">
            {walletUsed || "Waiting..."}
          </span>
          {walletUsed && (
            <Copy
              className="w-3 h-3 cursor-pointer text-primary hover:text-primary/70"
              onClick={() => copyToClipboard(walletUsed)}
            />
          )}
        </div>

        {/* Console Log Box */}
        <div className="max-h-[300px] overflow-y-auto text-sm font-mono bg-black/40 p-4 rounded-lg border border-border">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">
              Click a deployment button to start...
            </p>
          ) : (
            logs.map((l, i) => <p key={i}>{l}</p>)
          )}
        </div>

        {Object.keys(deployed).length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-2 text-primary">
              🧾 Deployed Addresses
            </h3>
            <ul className="text-sm space-y-1">
              {Object.entries(deployed).map(([name, addr]) => (
                <li key={name}>
                  <span className="font-semibold">{name}:</span>{" "}
                  <a
                    href={`https://amoy.polygonscan.com/address/${addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline"
                  >
                    {addr}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* KYC Management Section */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              KYC Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Approve or revoke KYC verification for freelancers
            </p>
          </div>

          <button
            onClick={fetchFreelancers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-surface-secondary transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg border flex items-center gap-3 ${notification.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{notification.message}</span>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Freelancers Table */}
        {!loading && !error && (
          <>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-secondary border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">
                        Freelancer
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">
                        Wallet Address
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">
                        KYC Status
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {freelancers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No freelancers found
                        </td>
                      </tr>
                    ) : (
                      freelancers.map((freelancer, index) => (
                        <motion.tr
                          key={freelancer.address}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="hover:bg-surface-secondary/50 transition"
                        >
                          <td className="px-4 py-4">
                            <div className="font-medium">{freelancer.name}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-mono text-sm text-muted-foreground">
                              {freelancer.address.slice(0, 6)}...
                              {freelancer.address.slice(-4)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {freelancer.isKYCVerified ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/30 text-xs font-medium">
                                <ShieldCheck className="w-3 h-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-medium">
                                <ShieldAlert className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {processingKYC === freelancer.address ? (
                              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                              </div>
                            ) : freelancer.isKYCVerified ? (
                              <button
                                onClick={() =>
                                  handleKYCAction(freelancer.address, false)
                                }
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition text-sm font-medium"
                              >
                                Revoke KYC
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleKYCAction(freelancer.address, true)
                                }
                                className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition text-sm font-medium"
                              >
                                Approve KYC
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats */}
            {freelancers.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-border bg-surface-secondary">
                  <div className="text-sm text-muted-foreground">Total Freelancers</div>
                  <div className="text-2xl font-bold mt-1">{freelancers.length}</div>
                </div>
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10">
                  <div className="text-sm text-green-400">Verified</div>
                  <div className="text-2xl font-bold mt-1 text-green-400">
                    {freelancers.filter((f) => f.isKYCVerified).length}
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <div className="text-sm text-amber-400">Pending</div>
                  <div className="text-2xl font-bold mt-1 text-amber-400">
                    {freelancers.filter((f) => !f.isKYCVerified).length}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* DISPUTES MANAGEMENT SECTION */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" />
              Dispute Resolution
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review and resolve disputes between clients and freelancers
            </p>
          </div>

          <button
            onClick={fetchDisputes}
            disabled={loadingDisputes}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-surface-secondary transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDisputes ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loadingDisputes && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!loadingDisputes && disputes.length === 0 && (
          <div className="p-8 rounded-lg border border-border bg-surface-secondary text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-lg font-semibold">No Active Disputes</p>
            <p className="text-sm text-muted-foreground mt-1">
              All jobs are running smoothly!
            </p>
          </div>
        )}

        {!loadingDisputes && disputes.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Job</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Freelancer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Budget</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {disputes.map((dispute, index) => (
                    <motion.tr
                      key={dispute.jobId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-surface-secondary/50 transition"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium">{dispute.jobTitle}</div>
                        <div className="text-xs text-muted-foreground">ID: {dispute.jobId}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-sm">{dispute.clientName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {dispute.client.slice(0, 6)}...{dispute.client.slice(-4)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-sm">{dispute.freelancerName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {dispute.freelancer.slice(0, 6)}...{dispute.freelancer.slice(-4)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-primary">{dispute.budget} USDT</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => setSelectedDispute(dispute)}
                          className="px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition text-sm font-medium"
                        >
                          Review
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* DISPUTE DETAIL MODAL */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-border shadow-xl"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Scale className="w-6 h-6 text-primary" />
                    Dispute Resolution
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Job #{selectedDispute.jobId} - {selectedDispute.jobTitle}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="p-2 rounded-lg hover:bg-surface-secondary transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Parties Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-surface-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Client</span>
                  </div>
                  <p className="font-medium">{selectedDispute.clientName}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {selectedDispute.client}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-surface-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Freelancer</span>
                  </div>
                  <p className="font-medium">{selectedDispute.freelancerName}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {selectedDispute.freelancer}
                  </p>
                </div>
              </div>

              {/* Budget */}
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/10">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Budget</span>
                </div>
                <p className="text-2xl font-bold text-primary">{selectedDispute.budget} USDT</p>
              </div>

              {/* Job Description */}
              <div className="p-4 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Job Requirements</span>
                </div>
                <p className="text-sm text-foreground-secondary whitespace-pre-wrap">
                  {selectedDispute.jobDescription}
                </p>
              </div>

              {/* Freelancer Deliverable */}
              <div className="p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-semibold">Freelancer Submitted Work</span>
                  </div>
                  {selectedDispute.lastDeliveryURI && (
                    <a
                      href={selectedDispute.lastDeliveryURI.replace("ipfs://", "https://ipfs.io/ipfs/")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View on IPFS <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedDispute.lastDeliveryURI ? "Work has been delivered" : "No delivery yet"}
                </p>
              </div>

              {/* Dispute Reason */}
              <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="font-semibold text-red-400">Client Dispute Reason</span>
                </div>
                <p className="text-sm text-foreground-secondary whitespace-pre-wrap">
                  {selectedDispute.disputeReason}
                </p>
              </div>

              {/* Resolution Options */}
              <div className="p-4 rounded-lg border border-border bg-surface-secondary">
                <h3 className="font-semibold mb-4">Admin Decision</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => handleResolveDispute("PAYOUT", 10000, 5)}
                    disabled={resolvingDispute}
                    className="w-full px-4 py-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition disabled:opacity-50 text-left"
                  >
                    <div className="font-medium">✅ Approve Freelancer Work</div>
                    <div className="text-xs mt-1">Pay 100% to freelancer (5★ rating)</div>
                  </button>

                  <button
                    onClick={() => handleResolveDispute("REFUND", 0, 0)}
                    disabled={resolvingDispute}
                    className="w-full px-4 py-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition disabled:opacity-50 text-left"
                  >
                    <div className="font-medium">❌ Reject Work - Refund Client</div>
                    <div className="text-xs mt-1">Full refund to client, no payment to freelancer</div>
                  </button>

                  <button
                    onClick={() => handleResolveDispute("PAYOUT", 5000, 3)}
                    disabled={resolvingDispute}
                    className="w-full px-4 py-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition disabled:opacity-50 text-left"
                  >
                    <div className="font-medium">⚖️ Partial Settlement (50/50)</div>
                    <div className="text-xs mt-1">Split payment: 50% to freelancer (3★), 50% refund to client</div>
                  </button>
                </div>

                {resolvingDispute && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resolving dispute...
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => setSelectedDispute(null)}
                disabled={resolvingDispute}
                className="w-full px-4 py-2 rounded-lg border border-border hover:bg-surface-secondary transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
