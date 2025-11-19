"use client";

import { useState } from "react";
import { Loader2, Server, Rocket, Copy } from "lucide-react";

export default function AdminPage() {
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deployed, setDeployed] = useState<Record<string, string>>({});
  const [walletUsed, setWalletUsed] = useState<string>("");

  const handleDeployAll = async () => {
    try {
      setDeploying(true);
      setLogs(["🚀 Starting deployment..."]);
      setDeployed({});
      setWalletUsed("");

      const res = await fetch("/api/deployAll", { method: "POST" });
      const data = await res.json();
      console.log("📦 Deployment response:", data);

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

  // ⭐ NEW: Deploy only TestUSDT on Polygon Amoy
  const handleDeployUSDTOnly = async () => {
    try {
      console.log("🚀 Starting TestUSDT-only deployment...");
      setDeploying(true);
      setLogs(["🚀 Deploying TestUSDT on Polygon Amoy..."]);
      setDeployed({});
      setWalletUsed("");

      const res = await fetch("/api/deployUSDT", { method: "POST" });
      const data = await res.json();

      console.log("📦 TestUSDT Deployment response:", data);

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
      console.error("❌ TestUSDT deployment failed:", err);
      setLogs((prev) => [...prev, "❌ Error: " + err.message]);
    } finally {
      setDeploying(false);
    }
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6 text-primary" /> Admin Contract Deployer
        </h1>
      </div>

      <section className="border border-border rounded-xl p-6 glass-effect">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Rocket className="w-5 h-5 text-primary" /> Deploy & Configure Stack
        </h2>

        {/* Existing "Deploy All" button */}
        <button
          disabled={deploying}
          onClick={handleDeployAll}
          className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-2"
        >
          {deploying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Deploying...
            </>
          ) : (
            "Deploy & Configure All Contracts"
          )}
        </button>

        {/* ⭐ NEW BUTTON — Deploy ONLY MockUSDT */}
        <button
          disabled={deploying}
          onClick={handleDeployUSDTOnly}
          className="px-5 py-3 bg-green-600 text-white rounded-lg hover:opacity-90 flex items-center gap-2 mt-3"
        >
          {deploying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Deploying TestUSDT...
            </>
          ) : (
            "Deploy TestUSDT Only (Polygon Amoy)"
          )}
        </button>

        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
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
        <div className="mt-6 max-h-[400px] overflow-y-auto text-sm font-mono bg-black/40 p-4 rounded-lg border border-border">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">
              Click a deployment button to start...
            </p>
          ) : (
            logs.map((l, i) => <p key={i}>{l}</p>)
          )}
        </div>

        {Object.keys(deployed).length > 0 && (
          <div className="mt-4">
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
    </main>
  );
}
