"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { Building2, Loader2, MessageSquare } from "lucide-react";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { client } from "@/lib/thirdweb-client";
import { getCompanyChatId, getCompanyChatParticipantAddress, setupCompanyGroupChat } from "@/lib/spacetimedb";
import { SpacetimeChat } from "@/components/chat/SpacetimeChat";

type CompanyChatItem = {
  id: bigint;
  owner: string;
  sector: string;
  metadataURI: string;
  meta: any;
};

const getGatewayUrl = (uri?: string) => {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  return uri;
};

export function CompanyGroupChatDashboard({ role }: { role: "founder" | "investor" }) {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const searchParams = useSearchParams();
  const requestedChatId = searchParams.get("chatId");
  const [companies, setCompanies] = useState<CompanyChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    if (!account) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const companyRegistry = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.CompanyRegistry as `0x${string}`,
      });

      let companyIds: bigint[] = [];

      if (role === "founder") {
        // The company is owned on-chain by whichever address sent createCompany.
        // Founders create the company from their personal EOA, but chat runs from
        // the smart wallet — so we must check both addresses (smart wallet first,
        // then EOA fallback), mirroring the founder dashboard lookup.
        let companyId = await readContract({
          contract: companyRegistry,
          method: "function ownerToCompanyId(address) view returns (uint256)",
          params: [account.address],
        }).catch(() => 0n) as bigint;

        if (companyId === 0n) {
          const eoaAddress = (() => {
            try {
              return (activeWallet as any)?.getAdminAccount?.()?.address as string | undefined;
            } catch {
              return undefined;
            }
          })();

          if (eoaAddress && eoaAddress.toLowerCase() !== account.address.toLowerCase()) {
            companyId = await readContract({
              contract: companyRegistry,
              method: "function ownerToCompanyId(address) view returns (uint256)",
              params: [eoaAddress],
            }).catch(() => 0n) as bigint;
          }
        }

        if (companyId > 0n) companyIds = [companyId];
      } else {
        const investorRegistry = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.InvestorRegistry as `0x${string}`,
        });
        companyIds = await readContract({
          contract: investorRegistry,
          method: "function getPortfolio(address) view returns (uint256[])",
          params: [account.address],
        }).catch(() => []) as bigint[];
      }

      const loaded = await Promise.all(companyIds.map(async (companyId) => {
        const company = await readContract({
          contract: companyRegistry,
          method: "function getCompany(uint256) view returns ((address owner, address token, address sale, address vault, address distributor, string metadataURI, string sector, bool exists))",
          params: [companyId],
        }).catch(() => null) as any;

        if (!company?.exists) return null;

        let meta = {};
        if (company.metadataURI) {
          try {
            const response = await fetch(getGatewayUrl(company.metadataURI));
            if (response.ok) meta = await response.json();
          } catch {}
        }

        return {
          id: companyId,
          owner: company.owner,
          sector: company.sector,
          metadataURI: company.metadataURI,
          meta,
        } satisfies CompanyChatItem;
      }));

      const nextCompanies = loaded.filter((company): company is CompanyChatItem => Boolean(company));
      setCompanies(nextCompanies);

      if (account) {
        nextCompanies.forEach((company) => {
          void setupCompanyGroupChat({
            companyId: company.id,
            founderAddress: company.owner,
            walletAddress: account.address,
            memberRole: role === "founder" ? "founder" : "investor",
          }).catch((err) => {
            console.error("Failed to sync company group chat membership:", err);
          });
        });
      }

      setSelectedChatId((current) => {
        if (requestedChatId && nextCompanies.some((company) => getCompanyChatId(company.id) === requestedChatId)) {
          return requestedChatId;
        }
        if (role === "founder" && nextCompanies[0]) {
          return getCompanyChatId(nextCompanies[0].id);
        }
        if (current && nextCompanies.some((company) => getCompanyChatId(company.id) === current)) {
          return current;
        }
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, [account, activeWallet, role, requestedChatId]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  if (!account) {
    return <div className="p-8 text-center text-muted-foreground">Connect your wallet to view company chats.</div>;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">
          {role === "founder" ? "Create a company to open its group chat." : "Buy company shares to join that company group chat."}
        </p>
      </div>
    );
  }

  const selectedCompany = companies.find((company) => getCompanyChatId(company.id) === selectedChatId) || companies[0];
  const showMobileChat = Boolean(selectedChatId);

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className={`w-full md:w-80 border-r border-border bg-surface-secondary flex-col ${showMobileChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Company Chats
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {companies.map((company) => {
            const chatId = getCompanyChatId(company.id);
            const active = getCompanyChatId(selectedCompany.id) === chatId;
            const logoUrl = getGatewayUrl(company.meta?.image);
            return (
              <button
                key={chatId}
                onClick={() => setSelectedChatId(chatId)}
                className={`w-full text-left p-4 border-b border-border/50 hover:bg-muted/50 transition-colors flex gap-3 items-center ${active ? "bg-muted/80 border-l-4 border-l-primary" : "border-l-4 border-l-transparent"}`}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{company.meta?.name || `Company #${company.id.toString()}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{company.sector}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 min-w-0 ${showMobileChat ? "flex" : "hidden md:flex"}`}>
        <div className="flex-1 min-h-0 flex flex-col">
          <button
            onClick={() => setSelectedChatId(null)}
            className="md:hidden p-3 text-left text-sm text-muted-foreground border-b border-border"
          >
            Back to company chats
          </button>
          <div className="flex-1 min-h-0">
            <SpacetimeChat
              jobId={getCompanyChatId(selectedCompany.id)}
              clientAddress={selectedCompany.owner}
              freelancerAddress={getCompanyChatParticipantAddress(selectedCompany.id)}
              currentUserRole={role}
              title={`${selectedCompany.meta?.name || `Company #${selectedCompany.id.toString()}`} Group Chat`}
              ensureRoom
            />
          </div>
        </div>
      </div>
    </div>
  );
}
