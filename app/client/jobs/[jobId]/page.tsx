"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getContract, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { motion } from "framer-motion";

import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

import {
  ArrowLeft,
  DollarSign,
  Clock,
  Tag,
  Users,
  Loader2,
} from "lucide-react";

export default function JobAnalyticsPage() {
  const router = useRouter();
  const { jobId } = useParams<{ jobId: string }>();
  const account = useActiveAccount();

  // SAFE PARSED BIGINT
  const numericJobId = useMemo(() => {
    try {
      return BigInt(jobId);
    } catch {
      return null;
    }
  }, [jobId]);

  const [job, setJob] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ----------------------------------------------------
      LOAD JOB DETAILS
  ---------------------------------------------------- */
  useEffect(() => {
    if (!account || numericJobId === null) return;

    async function loadJob() {
      try {
        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        const data = await readContract({
          contract: jobBoard,
          method:
            "function getJob(uint256) view returns (address,string,string,uint256,uint8,address,address,uint64,uint64,uint64,bytes32[],uint256)",
          params: [numericJobId as bigint], // <-- SAFE CAST
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
  rawTags,
  postingBond,
] = data as unknown as [
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


        // Fetch description JSON
        if (descriptionURI) {
          try {
            const res = await fetch(ipfsToHttp(descriptionURI));
            const json = await res.json();
            setDescription(json.description || "");
          } catch {
            setDescription(descriptionURI);
          }
        }

        // Decode tags
        const tagStrings = rawTags
          .map((hex: `0x${string}`) => {
            try {
              const bytes = new Uint8Array(
                hex
                  .slice(2)
                  .match(/.{1,2}/g)!
                  .map((b) => parseInt(b, 16))
              );
              return new TextDecoder()
                .decode(bytes)
                .replace(/\0/g, "")
                .trim();
            } catch {
              return "";
            }
          })
          .filter(Boolean);

        setJob({
          jobId: Number(numericJobId),
          client: clientAddr,
          title,
          budgetUSDC,
          status,
          createdAt,
          expiresAt,
          tags: tagStrings,
        });
      } catch (err) {
        console.error("❌ Failed to load job:", err);
      }
    }

    loadJob();
  }, [account, numericJobId]);

  /* ----------------------------------------------------
      LOAD APPLICANTS
  ---------------------------------------------------- */
  useEffect(() => {
    if (!account || numericJobId === null) return;

    async function loadApplicants() {
      try {
        const jobBoard = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.JobBoard,
        });

        const rawCount = await readContract({
          contract: jobBoard,
          method: "function getApplicantCount(uint256) view returns (uint256)",
          params: [numericJobId as bigint],
        });

        const count = Number(rawCount);

        if (count === 0) {
          setApplicants([]);
          setLoading(false);
          return;
        }

        const [freelancers, appliedAt] = (await readContract({
          contract: jobBoard,
          method:
            "function getApplicants(uint256,uint256,uint256) view returns (address[],uint64[])",
          params: [numericJobId as bigint, 0n, BigInt(count)],
        })) as [string[], bigint[]];

        const enriched = await Promise.all(
          freelancers.map(async (freelancer, i) => {
            if (freelancer === "0x0000000000000000000000000000000000000000")
              return null;

            try {
              const details = await readContract({
                contract: jobBoard,
                method:
                  "function getApplicantDetails(uint256,address) view returns (address,uint64,string,uint256,uint64)",
                params: [numericJobId as bigint, freelancer],
              });

              const [
  _f,
  appliedAtTs,
  proposalURI,
  bidAmount,
  deliveryDays,
] = details as unknown as [
  string,
  bigint,
  string,
  bigint,
  bigint
];


              let proposalText = "";
              try {
                if (proposalURI?.length > 0) {
                  const res = await fetch(ipfsToHttp(proposalURI));
                  const j = await res.json();
                  proposalText = j.proposal || "";
                }
              } catch {}

              return {
                freelancer,
                appliedAt: appliedAtTs,
                proposalText,
                bidAmount,
                deliveryDays,
              };
            } catch {
              return null;
            }
          })
        );

        setApplicants(enriched.filter(Boolean));
      } catch (err) {
        console.error("❌ Applicant load failed:", err);
      } finally {
        setLoading(false);
      }
    }

    loadApplicants();
  }, [account, numericJobId]);

  /* ----------------------------------------------------
      UI RENDERING
  ---------------------------------------------------- */

  if (!account)
    return (
      <main className="p-8 text-center">Please connect your wallet.</main>
    );

  if (!job)
    return (
      <main className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </main>
    );

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-10">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* ================================
          JOB HEADER
      ================================ */}
      <section className="glass-effect border rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold">{job.title}</h1>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            {(Number(job.budgetUSDC) / 1e6).toFixed(2)} USDT
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Posted: {new Date(Number(job.createdAt) * 1000).toLocaleString()}
          </div>
        </div>

        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {job.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs border border-primary/20"
              >
                <Tag className="w-3 h-3 inline-block mr-1" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ================================
          DESCRIPTION
      ================================ */}
      <section className="glass-effect border rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Job Description</h2>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {description || "No description provided."}
        </p>
      </section>

      {/* ================================
          APPLICANTS
      ================================ */}
      <section className="glass-effect border rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Applicants ({applicants.length})
        </h2>

        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!loading && applicants.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            No applicants yet.
          </p>
        )}

        <div className="space-y-4">
          {applicants.map((app, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="border glass-effect rounded-xl p-4 space-y-3"
            >
              {/* Header Section */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-sm break-all">
                  {app.freelancer.slice(0, 8)}...{app.freelancer.slice(-6)}
                </span>

                <button
                  onClick={() =>
                    router.push(`/freelancer/${app.freelancer}`)
                  }
                  className="px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/30 text-sm hover:opacity-80"
                >
                  View Profile
                </button>
              </div>

              {/* Applied Timestamp */}
              <div className="text-xs text-muted-foreground">
                Applied on:{" "}
                {new Date(Number(app.appliedAt) * 1000).toLocaleString()}
              </div>

              {/* Proposal */}
              {app.proposalText && (
                <p className="text-sm bg-background/40 rounded-lg p-3 border whitespace-pre-wrap">
                  {app.proposalText}
                </p>
              )}

              {/* Bid & Delivery */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Bid: {(Number(app.bidAmount) / 1e6).toFixed(2)} USDT
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {app.deliveryDays} days delivery
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
