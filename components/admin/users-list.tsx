"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Briefcase, UserCheck, UserX, Shield, CheckCircle2, XCircle } from "lucide-react";
import { getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { motion } from "framer-motion";

interface FreelancerData {
  address: string;
  profileAddress: string;
  name: string;
  bio: string;
  profileURI: string;
  rating: number;
  completedJobs: number;
  totalPoints: number;
  isKYCVerified: boolean;
  level: number;
  isAlsoClient: boolean;
  clientProfileAddress?: string;
  clientName?: string;
}

interface ClientData {
  address: string;
  profileAddress: string;
  name: string;
  bio: string;
  company: string;
  profileImage: string;
  totalJobsPosted: number;
  totalJobsCompleted: number;
  isAlsoFreelancer: boolean;
  freelancerProfileAddress?: string;
  freelancerName?: string;
}

export function UsersList() {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(true);
  const [freelancers, setFreelancers] = useState<FreelancerData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      setIsAdmin(false);
      return;
    }

    checkAdminStatus();
    loadUsers();
  }, [account]);

  const checkAdminStatus = async () => {
    if (!account) {
      setIsAdmin(false);
      return;
    }

    try {
      const freelancerFactory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
      });

      const owner = await readContract({
        contract: freelancerFactory,
        method: "function owner() view returns (address)",
      });

      setIsAdmin((owner as string).toLowerCase() === account.address.toLowerCase());
    } catch (e) {
      console.error("Error checking admin status:", e);
      setIsAdmin(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const freelancerFactory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
      });

      const clientFactory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
      });

      // Get all freelancers
      const [freelancerWallets, freelancerProfiles] = (await readContract({
        contract: freelancerFactory,
        method: "function getAllFreelancerProfiles() view returns (address[],address[])",
      })) as [string[], string[]];

      // Get clients from JobBoard (clients who posted jobs)
      const jobBoard = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.JobBoard,
      });

      // We'll get clients by checking job creators
      // For now, we'll check if freelancers are also clients
      const freelancerData: FreelancerData[] = [];
      const clientAddresses = new Set<string>();
      const clientDataMap = new Map<string, ClientData>();

      // Process freelancers
      for (let i = 0; i < freelancerWallets.length; i++) {
        const wallet = freelancerWallets[i];
        const profileAddr = freelancerProfiles[i];

        if (!wallet || !profileAddr || wallet === "0x0000000000000000000000000000000000000000") {
          continue;
        }

        try {
          const profile = getContract({
            client,
            chain: CHAIN,
            address: profileAddr as `0x${string}`,
          });

          const [
            name,
            bio,
            profileURI,
            totalPoints,
            completedJobs,
            level,
            isKYCVerified,
          ] = await Promise.all([
            readContract({
              contract: profile,
              method: "function name() view returns (string)",
            }),
            readContract({
              contract: profile,
              method: "function bio() view returns (string)",
            }),
            readContract({
              contract: profile,
              method: "function profileURI() view returns (string)",
            }),
            readContract({
              contract: profile,
              method: "function totalPoints() view returns (uint256)",
            }),
            readContract({
              contract: profile,
              method: "function completedJobs() view returns (uint256)",
            }),
            readContract({
              contract: profile,
              method: "function level() view returns (uint8)",
            }),
            readContract({
              contract: profile,
              method: "function isKYCVerified() view returns (bool)",
            }),
          ]);

          // Check if this freelancer is also a client
          let isAlsoClient = false;
          let clientProfileAddress: string | undefined;
          let clientName: string | undefined;

          try {
            const clientProfileAddr = await readContract({
              contract: clientFactory,
              method: "function clientProfiles(address) view returns (address)",
              params: [wallet],
            });

            if (
              clientProfileAddr &&
              clientProfileAddr !== "0x0000000000000000000000000000000000000000"
            ) {
              isAlsoClient = true;
              clientProfileAddress = clientProfileAddr as string;

              const clientProfile = getContract({
                client,
                chain: CHAIN,
                address: clientProfileAddr as `0x${string}`,
              });

              clientName = (await readContract({
                contract: clientProfile,
                method: "function name() view returns (string)",
              })) as string;
            }
          } catch (e) {
            // Not a client, continue
          }

          const rating =
            Number(completedJobs) > 0
              ? Number(totalPoints) / Number(completedJobs) / 20
              : 0;

          freelancerData.push({
            address: wallet,
            profileAddress: profileAddr,
            name: name as string,
            bio: bio as string,
            profileURI: profileURI as string,
            rating: Math.min(5, Math.max(0, rating)),
            completedJobs: Number(completedJobs),
            totalPoints: Number(totalPoints),
            isKYCVerified: isKYCVerified as boolean,
            level: Number(level),
            isAlsoClient,
            clientProfileAddress,
            clientName,
          });
        } catch (e) {
          console.error(`Error loading freelancer ${wallet}:`, e);
        }
      }

      // Get clients from JobBoard (unique job creators)
      try {
        // We'll get clients by checking jobs posted
        // Since we can't iterate all jobs easily, we'll check known addresses
        // For a complete solution, you'd want to add getAllClients() to ClientFactory
        
        // Check freelancers who are also clients (already done above)
        // For pure clients (not freelancers), we'd need to track them differently
        // For now, we'll show freelancers and mark which are clients
        
        setFreelancers(freelancerData);
        
        // Extract pure clients from freelancer data
        const pureClients: ClientData[] = [];
        for (const freelancer of freelancerData) {
          if (freelancer.isAlsoClient && freelancer.clientProfileAddress) {
            try {
              const clientProfile = getContract({
                client,
                chain: CHAIN,
                address: freelancer.clientProfileAddress as `0x${string}`,
              });

              const [name, bio, company, profileImage, posted, completed] = await Promise.all([
                readContract({
                  contract: clientProfile,
                  method: "function name() view returns (string)",
                }),
                readContract({
                  contract: clientProfile,
                  method: "function bio() view returns (string)",
                }),
                readContract({
                  contract: clientProfile,
                  method: "function company() view returns (string)",
                }),
                readContract({
                  contract: clientProfile,
                  method: "function profileImage() view returns (string)",
                }),
                readContract({
                  contract: clientProfile,
                  method: "function totalJobsPosted() view returns (uint256)",
                }),
                readContract({
                  contract: clientProfile,
                  method: "function totalJobsCompleted() view returns (uint256)",
                }),
              ]);

              pureClients.push({
                address: freelancer.address,
                profileAddress: freelancer.clientProfileAddress,
                name: name as string,
                bio: bio as string,
                company: company as string,
                profileImage: profileImage as string,
                totalJobsPosted: Number(posted),
                totalJobsCompleted: Number(completed),
                isAlsoFreelancer: true,
                freelancerProfileAddress: freelancer.profileAddress,
                freelancerName: freelancer.name,
              });
            } catch (e) {
              console.error(`Error loading client profile:`, e);
            }
          }
        }
        
        setClients(pureClients);
      } catch (e) {
        console.error("Error loading clients:", e);
      }
    } catch (err: any) {
      console.error("Error loading users:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyKYC = async (freelancerAddress: string, currentStatus: boolean) => {
    if (!account || !isAdmin) return;

    try {
      setVerifying(freelancerAddress);
      const freelancerFactory = getContract({
        client,
        chain: CHAIN,
        address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
      });

      const tx = await prepareContractCall({
        contract: freelancerFactory,
        method: "function setKYCFor(address,bool)",
        params: [freelancerAddress as `0x${string}`, !currentStatus],
      });

      await sendTransaction({ account, transaction: tx });

      // Reload users to update KYC status
      await loadUsers();
    } catch (err: any) {
      console.error("Error verifying KYC:", err);
      setError(err.message || "Failed to update KYC status");
    } finally {
      setVerifying(null);
    }
  };

  if (!account) {
    return (
      <div className="p-6 border border-border rounded-xl glass-effect">
        <p className="text-muted-foreground">Please connect your wallet to view users.</p>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="p-6 border border-red-500/50 rounded-xl glass-effect bg-red-500/10">
        <div className="flex items-center gap-2 text-red-400">
          <Shield className="w-5 h-5" />
          <p className="font-semibold">Access Denied</p>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Only the factory contract owner can view this section.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-500 rounded-xl glass-effect">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Freelancers Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Freelancers ({freelancers.length})
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {freelancers.map((freelancer, idx) => (
            <motion.div
              key={freelancer.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 border border-border rounded-xl glass-effect"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{freelancer.name}</h3>
                <div className="flex items-center gap-2">
                  {freelancer.isAlsoClient && (
                    <div className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                      <UserCheck className="w-3 h-3" />
                      Client
                    </div>
                  )}
                  {freelancer.isKYCVerified ? (
                    <div className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                      <XCircle className="w-3 h-3" />
                      Not Verified
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {freelancer.bio}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-mono">{freelancer.address.slice(0, 6)}...{freelancer.address.slice(-4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rating:</span>
                  <span>{freelancer.rating.toFixed(2)} ⭐</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs Completed:</span>
                  <span>{freelancer.completedJobs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level:</span>
                  <span>{freelancer.level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KYC:</span>
                  <span className={freelancer.isKYCVerified ? "text-green-400" : "text-red-400"}>
                    {freelancer.isKYCVerified ? "✓ Verified" : "✗ Not Verified"}
                  </span>
                </div>
                {freelancer.isAlsoClient && freelancer.clientName && (
                  <div className="flex justify-between pt-1 border-t border-border">
                    <span className="text-muted-foreground">Client Name:</span>
                    <span>{freelancer.clientName}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <button
                  onClick={() => handleVerifyKYC(freelancer.address, freelancer.isKYCVerified)}
                  disabled={verifying === freelancer.address}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition ${
                    freelancer.isKYCVerified
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  } disabled:opacity-50`}
                >
                  {verifying === freelancer.address ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : freelancer.isKYCVerified ? (
                    "Revoke KYC"
                  ) : (
                    "Verify KYC"
                  )}
                </button>
              </div>
            </motion.div>
          ))}
          {freelancers.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              No freelancers found.
            </p>
          )}
        </div>
      </section>

      {/* Clients Section */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-primary" /> Clients ({clients.length})
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, idx) => (
            <motion.div
              key={client.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 border border-border rounded-xl glass-effect"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{client.name}</h3>
                {client.isAlsoFreelancer && (
                  <div className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                    <UserCheck className="w-3 h-3" />
                    Freelancer
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">{client.company}</p>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {client.bio}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-mono">{client.address.slice(0, 6)}...{client.address.slice(-4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs Posted:</span>
                  <span>{client.totalJobsPosted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs Completed:</span>
                  <span>{client.totalJobsCompleted}</span>
                </div>
                {client.isAlsoFreelancer && client.freelancerName && (
                  <div className="flex justify-between pt-1 border-t border-border">
                    <span className="text-muted-foreground">Freelancer Name:</span>
                    <span>{client.freelancerName}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {clients.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              No clients found. (Note: Pure clients without freelancer profiles are not tracked yet)
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

