"use client";

import { useState } from "react";
import { Loader2, Rocket, Copy, CheckCircle2 } from "lucide-react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from "thirdweb";
import { deployContract } from "thirdweb/deploys";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import type { Abi } from "viem";

interface DeploymentLog {
  type: "info" | "success" | "error";
  message: string;
}

interface ContractDeployerProps {
  useMetaMask?: boolean;
}

export function ContractDeployer({ useMetaMask = false }: ContractDeployerProps) {
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [deployed, setDeployed] = useState<Record<string, string>>({});

  // When MetaMask is connected and useMetaMask is true, useActiveAccount will return MetaMask account
  // Otherwise, it returns the regular account (or null if not connected)
  // If useMetaMask is true but MetaMask is not connected, account will be null
  const account = useMetaMask 
    ? (activeWallet?.id === "io.metamask" ? activeAccount : null)
    : activeAccount;

  const addLog = (message: string, type: "info" | "success" | "error" = "info") => {
    setLogs((prev) => [...prev, { type, message }]);
    console.log(message);
  };

  const loadArtifact = async (file: string) => {
    const response = await fetch(`/api/artifacts/contracts/${file}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load artifact: ${file}`);
    }
    return response.json();
  };

  const callTx = async (contract: any, method: string, params: any[]) => {
    if (!account) throw new Error("No account connected");
    const prepared = await prepareContractCall({
      contract,
      method,
      params,
    });
    await sendTransaction({ account, transaction: prepared });
  };

  const handleDeployAll = async () => {
    if (!account) {
      addLog("❌ Please connect your wallet first", "error");
      return;
    }

    try {
      setDeploying(true);
      setLogs([]);
      setDeployed({});

      addLog("🚀 Starting deployment...");
      addLog(`👤 Deployer Wallet: ${account.address}`);

      // 1️⃣ Use external USDT
      const usdtAddr = process.env.NEXT_PUBLIC_USDT_ADDRESS || DEPLOYED_CONTRACTS.addresses.MockUSDT;
      if (!usdtAddr) {
        throw new Error("USDT_ADDRESS is missing. Please set NEXT_PUBLIC_USDT_ADDRESS in .env");
      }
      addLog(`💰 Using USDT token: ${usdtAddr}`);

      // 2️⃣ Deploy FreelancerFactory
      addLog("\n🚀 Deploying FreelancerFactory...");
      const ffA = await loadArtifact("FreelancerFactory.sol/FreelancerFactory");
      const freelancerFactoryAddr = await deployContract({
        client,
        chain: CHAIN,
        account,
        abi: ffA.abi as Abi,
        bytecode: ffA.bytecode as `0x${string}`,
      });
      addLog(`✅ FreelancerFactory deployed at: ${freelancerFactoryAddr}`, "success");

      // 3️⃣ Deploy ClientFactory
      addLog("\n🚀 Deploying ClientFactory...");
      const cfA = await loadArtifact("ClientFactory.sol/ClientFactory");
      const clientFactoryAddr = await deployContract({
        client,
        chain: CHAIN,
        account,
        abi: cfA.abi as Abi,
        bytecode: cfA.bytecode as `0x${string}`,
      });
      addLog(`✅ ClientFactory deployed at: ${clientFactoryAddr}`, "success");

      // 4️⃣ Deploy JobBoard
      addLog("\n🚀 Deploying JobBoard...");
      const jbA = await loadArtifact("JobBoard.sol/JobBoard");
      const jobBoardAddr = await deployContract({
        client,
        chain: CHAIN,
        account,
        abi: jbA.abi as Abi,
        bytecode: jbA.bytecode as `0x${string}`,
        constructorParams: { _owner: account.address },
      });
      addLog(`✅ JobBoard deployed at: ${jobBoardAddr}`, "success");

      // 5️⃣ Deploy EscrowFactory
      addLog("\n🚀 Deploying EscrowFactory...");
      const efA = await loadArtifact("EscrowFactory.sol/EscrowFactory");
      const platformWallet = account.address;
      const resolver = account.address;
      const platformFeeBps = 200;

      const escrowFactoryAddr = await deployContract({
        client,
        chain: CHAIN,
        account,
        abi: efA.abi as Abi,
        bytecode: efA.bytecode as `0x${string}`,
        constructorParams: {
          _freelancerFactory: freelancerFactoryAddr,
          _usdt: usdtAddr,
          _platformWallet: platformWallet,
          _platformFeeBps: platformFeeBps,
          _resolver: resolver,
          _jobBoard: jobBoardAddr,
        },
      });
      addLog(`✅ EscrowFactory deployed at: ${escrowFactoryAddr}`, "success");

      // 6️⃣ Wire contracts
      addLog("\n🔗 Wiring contracts...");

      const freelancerFactory = getContract({
        client,
        chain: CHAIN,
        address: freelancerFactoryAddr,
      });

      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: jobBoardAddr,
      });

      // Authorize EscrowFactory in FreelancerFactory
      addLog("🔗 Authorizing EscrowFactory in FreelancerFactory...");
      await callTx(
        freelancerFactory,
        "function setEscrowDeployer(address,bool)",
        [escrowFactoryAddr, true]
      );
      addLog("✅ EscrowFactory authorized", "success");

      // Allow EscrowFactory in JobBoard
      addLog("🔗 Allowing EscrowFactory in JobBoard...");
      await callTx(
        jobBoard,
        "function setAllowedFactory(address,bool)",
        [escrowFactoryAddr, true]
      );
      addLog("✅ EscrowFactory allowed in JobBoard", "success");

      // Set USDT in JobBoard
      addLog("🔗 Setting USDT in JobBoard...");
      await callTx(jobBoard, "function setUSDC(address)", [usdtAddr]);
      addLog("✅ USDT set in JobBoard", "success");

      // Disable requireApplicationToHire
      addLog("🔗 Configuring JobBoard...");
      await callTx(jobBoard, "function setRequireApplicationToHire(bool)", [false]);
      addLog("✅ JobBoard configured", "success");

      setDeployed({
        USDT: usdtAddr,
        FreelancerFactory: freelancerFactoryAddr,
        ClientFactory: clientFactoryAddr,
        JobBoard: jobBoardAddr,
        EscrowFactory: escrowFactoryAddr,
      });

      addLog("\n🎯 Deployment Complete!", "success");
    } catch (err: any) {
      console.error("❌ Deployment failed:", err);
      addLog(`❌ Deployment failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployUSDT = async () => {
    if (!account) {
      addLog("❌ Please connect your wallet first", "error");
      return;
    }

    try {
      setDeploying(true);
      setLogs([]);
      setDeployed({});

      addLog("🚀 Starting TestUSDT Deployment...");
      addLog(`👤 Deployer: ${account.address}`);

      const usdtA = await loadArtifact("TestUSDT.sol/MockUSDT");
      addLog("📦 Deploying TestUSDT...");

      const usdtAddr = await deployContract({
        client,
        chain: CHAIN,
        account,
        abi: usdtA.abi as Abi,
        bytecode: usdtA.bytecode as `0x${string}`,
      });
      addLog(`✅ TestUSDT deployed at: ${usdtAddr}`, "success");

      // Transfer supply to deployer
      const usdtContract = getContract({
        client,
        chain: CHAIN,
        address: usdtAddr as `0x${string}`,
      });

      addLog("💰 Reading totalSupply...");
      const totalSupply = (await readContract({
        contract: usdtContract,
        method: "function totalSupply() view returns (uint256)",
      })) as bigint;

      addLog(`🔢 Total Supply: ${totalSupply.toString()}`);

      addLog("💸 Transferring supply to deployer...");
      await callTx(
        usdtContract,
        "function transfer(address,uint256)",
        [account.address, totalSupply]
      );
      addLog("✅ USDT transferred to deployer!", "success");

      setDeployed({
        TestUSDT: usdtAddr,
      });

      addLog("🎯 TestUSDT Deployment Complete!", "success");
    } catch (err: any) {
      console.error("❌ Deployment failed:", err);
      addLog(`❌ Deployment failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setDeploying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog("📋 Copied to clipboard!", "success");
  };

  if (!account) {
    return (
      <div className="p-6 border border-border rounded-xl glass-effect">
        <p className="text-muted-foreground">
          Please connect your wallet to deploy contracts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" /> Deploy & Configure Stack
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
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
            <>
              <Rocket className="w-4 h-4" /> Deploy & Configure All Contracts
            </>
          )}
        </button>

        <button
          disabled={deploying}
          onClick={handleDeployUSDT}
          className="px-5 py-3 bg-green-600 text-white rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
        >
          {deploying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Deploying...
            </>
          ) : (
            "Deploy TestUSDT Only"
          )}
        </button>
      </div>

      {/* Console Log Box */}
      <div className="max-h-[400px] overflow-y-auto text-sm font-mono bg-black/40 p-4 rounded-lg border border-border">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">Click a deployment button to start...</p>
        ) : (
          logs.map((log, i) => (
            <p
              key={i}
              className={
                log.type === "error"
                  ? "text-red-400"
                  : log.type === "success"
                  ? "text-green-400"
                  : "text-foreground"
              }
            >
              {log.message}
            </p>
          ))
        )}
      </div>

      {Object.keys(deployed).length > 0 && (
        <div className="mt-4 p-4 border border-border rounded-xl glass-effect">
          <h3 className="font-semibold text-lg mb-3 text-primary flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Deployed Addresses
          </h3>
          <div className="space-y-2">
            {Object.entries(deployed).map(([name, addr]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{name}:</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://amoy.polygonscan.com/address/${addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    {addr.slice(0, 10)}...{addr.slice(-8)}
                  </a>
                  <Copy
                    className="w-4 h-4 cursor-pointer text-primary hover:text-primary/70"
                    onClick={() => copyToClipboard(addr)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

