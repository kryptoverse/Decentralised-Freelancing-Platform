"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { ContractDeployer } from "@/components/admin/contract-deployer";
import { UsersList } from "@/components/admin/users-list";
import { MetaMaskConnector } from "@/components/admin/metamask-connector";

export default function AdminPage() {
  const [metamaskAddress, setMetamaskAddress] = useState<string | null>(null);

  return (
    <main className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6 text-primary" /> Admin Dashboard
        </h1>
      </div>

      {/* MetaMask Connector Section */}
      <section className="border border-border rounded-xl p-6 glass-effect">
        <MetaMaskConnector onAccountChange={setMetamaskAddress} />
      </section>

      {/* Contract Deployment Section */}
      <section className="border border-border rounded-xl p-6 glass-effect">
        <ContractDeployer useMetaMask={!!metamaskAddress} />
      </section>

      {/* Users List Section */}
      <section className="border border-border rounded-xl p-6 glass-effect">
        <UsersList />
      </section>
    </main>
  );
}
