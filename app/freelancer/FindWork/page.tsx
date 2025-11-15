"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";
import { Briefcase, Clock, DollarSign, Loader2 } from "lucide-react";

interface Job {
  jobId: number;
  client: string;
  title: string;
  description: string;
  budgetUSDC: bigint;
  status: number; // 0=Unknown, 1=Open, 2=Hired, 3=Cancelled, 4=Completed, 5=Expired
  createdAt: bigint;
  expiresAt: bigint;
  tags: string[];
}

export default function FindWorkPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;

    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1️⃣ Get JobBoard contract
        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        // 2️⃣ Get total open jobs count
        const totalOpen = await readContract({
          contract: jobBoard,
          method: "function totalOpenJobs() view returns (uint256)",
        });

        if (Number(totalOpen) === 0) {
          setJobs([]);
          return;
        }

        // 3️⃣ Fetch open job IDs (paginated)
        const limit = 50; // Fetch first 50 jobs
        const jobIds = await readContract({
          contract: jobBoard,
          method: "function openJobs(uint256,uint256) view returns (uint256[])",
          params: [0n, BigInt(limit)],
        });

        if (!jobIds || jobIds.length === 0) {
          setJobs([]);
          return;
        }

        // 4️⃣ Fetch each job's details
        const jobPromises = jobIds.map(async (jobId: bigint) => {
          try {
            const jobData = await readContract({
              contract: jobBoard,
              method:
                "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
              params: [jobId],
            });

            const [
              clientAddr,
              title,
              descriptionURI,
              budgetUSDC,
              status,
              hiredFreelancer,
              escrow,
              createdAt,
              updatedAt,
              expiresAt,
              tags,
              postingBond,
            ] = jobData as [
              string,
              string,
              string,
              bigint,
              number,
              string,
              string,
              bigint,
              bigint,
              bigint,
              `0x${string}`[],
              bigint
            ];

            // Only show Open jobs (status = 1)
            if (Number(status) !== 1) return null;

            // Fetch description from IPFS
            let description = "";
            if (
              descriptionURI &&
              typeof descriptionURI === "string" &&
              descriptionURI.trim() !== ""
            ) {
              try {
                const res = await fetch(ipfsToHttp(descriptionURI));
                if (res.ok) {
                  const data = await res.json();
                  description = data.description || descriptionURI;
                }
              } catch (e) {
                console.warn("Failed to fetch job description:", e);
                description = "Job description available on IPFS";
              }
            }

            // Convert tags from bytes32 to strings
            const tagStrings = (tags as `0x${string}`[])
              .map((tag) => {
                try {
                  const hex = tag.slice(2);
                  const bytes = new Uint8Array(
                    hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
                  );
                  const text = new TextDecoder().decode(bytes);
                  return text.replace(/\0/g, "").trim();
                } catch {
                  return "";
                }
              })
              .filter((tag) => tag.length > 0);

            return {
              jobId: Number(jobId),
              client: clientAddr as string,
              title: title as string,
              description: description || (descriptionURI as string),
              budgetUSDC: budgetUSDC as bigint,
              status: Number(status),
              createdAt: createdAt as bigint,
              expiresAt: expiresAt as bigint,
              tags: tagStrings,
            };
          } catch (err) {
            console.warn(`Failed to fetch job ${jobId}:`, err);
            return null;
          }
        });

        const results = await Promise.all(jobPromises);
        setJobs(results.filter(Boolean) as Job[]);
      } catch (err: any) {
        console.error("❌ Failed to load jobs:", err);
        setError(err?.message || "Failed to fetch jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [account]);

  if (!account) {
    return (
      <div className="p-8 text-center text-foreground-secondary">
        Please connect your wallet to browse jobs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Find Work</h1>
        <p className="text-foreground-secondary">
          Browse open projects and start earning by working with verified clients.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No open jobs available at the moment.</p>
          <p className="text-sm mt-2">Check back later for new opportunities!</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job, i) => {
            const expiresInDays =
              job.expiresAt > 0n
                ? Math.max(
                    0,
                    Math.ceil(
                      (Number(job.expiresAt) - Date.now() / 1000) /
                        (24 * 60 * 60)
                    )
                  )
                : null;

            return (
              <motion.div
                key={job.jobId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-effect rounded-xl p-6 border border-border hover:shadow-lg hover:border-primary/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-foreground flex-1">
                    {job.title}
                  </h3>
                </div>

                <p className="text-sm text-foreground-secondary mb-4 line-clamp-3">
                  {job.description || "No description available"}
                </p>

                {/* Tags */}
                {job.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {job.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs border border-primary/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Job Details */}
                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <DollarSign className="w-4 h-4" />
                    <span>
                      {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
                    </span>
                  </div>
                  {expiresInDays !== null && (
                    <div className="flex items-center gap-2 text-foreground-secondary">
                      <Clock className="w-4 h-4" />
                      <span>
                        {expiresInDays > 0
                          ? `${expiresInDays} days left`
                          : "Expired soon"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Client Info */}
                <div className="text-xs text-foreground-secondary mb-4">
                  Client: {job.client.slice(0, 6)}...
                  {job.client.slice(-4)}
                </div>

                {/* Action Button */}
                <button
                  onClick={() =>
                    router.push(`/freelancer/FindWork/${job.jobId}`)

                  }
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium"
                >
                  View Details
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
