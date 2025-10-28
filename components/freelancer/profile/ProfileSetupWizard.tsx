"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  readContract,
  sendTransaction,
} from "thirdweb";
import { Upload, X } from "lucide-react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";

export function ProfileSetupWizard() {
  const account = useActiveAccount();
  const { uploadFile, uploadMetadata, uploading, progress } = useIPFSUpload();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [isUpdating, setIsUpdating] = useState(false);
  const [profileAddress, setProfileAddress] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    headline: "",
    bio: "",
    profileImage: null as File | null,
    introVideo: null as File | null,
    education: [{ degree: "", institution: "", year: "" }],
    certificates: [{ title: "", issuer: "", year: "", file: null as File | null }],
    skills: [] as string[],
    portfolio: [{ title: "", description: "", link: "", image: null as File | null }],
  });

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  // 🧭 Prefill data if profile already deployed
  useEffect(() => {
    const fetchProfile = async () => {
      if (!account?.address) return;

      try {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const profileAddr = await readContract({
          contract: factory,
          method:
            "function freelancerProfile(address) view returns (address)",
          params: [account.address],
        });

        if (
          !profileAddr ||
          profileAddr === "0x0000000000000000000000000000000000000000"
        ) {
          console.log("No profile found — new user.");
          return;
        }

        setProfileAddress(profileAddr);
        setIsUpdating(true);

        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddr as `0x${string}`,
        });

        const [name, bio] = await Promise.all([
          readContract({
            contract: profileContract,
            method: "function name() view returns (string)",
          }),
          readContract({
            contract: profileContract,
            method: "function bio() view returns (string)",
          }),
        ]);

        setForm((prev) => ({
          ...prev,
          name,
          bio,
        }));
      } catch (err) {
        console.error("Profile fetch failed:", err);
      }
    };

    fetchProfile();
  }, [account?.address]);

  // 🧱 Deploy or update
  const handleSaveProfile = async () => {
    if (!account) {
      setMsg("⚠️ Connect wallet first.");
      return;
    }

    try {
      setLoading(true);
      setMsg("🚀 Uploading profile data to IPFS...");

      const imageUri = form.profileImage ? await uploadFile(form.profileImage) : "";
      const videoUri = form.introVideo ? await uploadFile(form.introVideo) : "";

      const certUris = await Promise.all(
        form.certificates.map(async (c) => (c.file ? await uploadFile(c.file) : ""))
      );

      const portfolioUris = await Promise.all(
        form.portfolio.map(async (p) => (p.image ? await uploadFile(p.image) : ""))
      );

      const metadata = {
        name: form.name,
        headline: form.headline,
        bio: form.bio,
        profileImage: imageUri,
        introVideo: videoUri,
        education: form.education,
        certificates: form.certificates.map((c, i) => ({ ...c, file: certUris[i] })),
        skills: form.skills,
        portfolio: form.portfolio.map((p, i) => ({ ...p, image: portfolioUris[i] })),
      };

      const metadataURI = await uploadMetadata(metadata);
      setMsg(`📦 Uploaded metadata: ${metadataURI}`);

      if (isUpdating && profileAddress) {
        // Update existing
        setMsg("✏️ Updating on-chain profile...");
        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddress as `0x${string}`,
        });

        const tx = await prepareContractCall({
          contract: profileContract,
          method: "function updateProfile(string,string,string)",
          params: [form.name, form.bio, metadataURI],
        });

        await sendTransaction({ account, transaction: tx });
        setMsg("✅ Profile updated successfully!");
      } else {
        // Deploy new
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory,
        });

        const tx = await prepareContractCall({
          contract: factory,
          method:
            "function deployFreelancerProfile(string,string,string) returns (address)",
          params: [form.name, form.bio, metadataURI],
        });

        await sendTransaction({ account, transaction: tx });
        setMsg("✅ Profile created successfully!");
      }

      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error("❌ Profile save failed:", err);
      setMsg("❌ Transaction reverted. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  // 🖼️ Custom File Upload element
  const FileUpload = ({
    label,
    accept,
    note,
    file,
    onChange,
  }: {
    label: string;
    accept?: string;
    note?: string;
    file: File | null;
    onChange: (file: File | null) => void;
  }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
      if (file && file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setPreviewUrl(null);
      }
    }, [file]);

    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold">{label}</p>
        {note && <p className="text-xs text-foreground-secondary">{note}</p>}
        <label
          className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed ${
            file ? "border-primary bg-primary/10" : "border-border hover:border-primary"
          } transition cursor-pointer h-44 bg-surface-secondary`}
        >
          {file ? (
            <div className="relative flex flex-col items-center justify-center h-full w-full">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="object-cover w-full h-full rounded-xl"
                />
              ) : (
                <div className="text-center px-3">
                  <p className="text-sm text-foreground-secondary truncate">
                    {file.name}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onChange(null);
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload className="w-8 h-8 text-foreground-secondary" />
              <p className="text-sm text-foreground-secondary text-center">
                Click or drag & drop to upload
              </p>
            </div>
          )}
          <input
            type="file"
            accept={accept}
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
        </label>
      </div>
    );
  };

  // 🧭 Step titles
  const titles = [
    "Basic Info",
    "Media Uploads",
    "Education & Certificates",
    "Skills & Portfolio",
    "Review & Publish",
  ];

  return (
    <div className="p-6 rounded-2xl glass-effect border border-border shadow-md space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-primary">Set Up Your Freelancer Profile</h2>
      <p className="text-sm text-foreground-secondary">
        Step {step} of 5 — {titles[step - 1]}
      </p>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Full Name</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Your full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <label className="block text-sm font-semibold">Headline</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Web3 Developer | Solidity | Frontend"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />

          <label className="block text-sm font-semibold">Bio</label>
          <textarea
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Describe your skills, experience, and goals..."
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>
      )}

      {/* Step 2: Uploads */}
      {step === 2 && (
        <div className="space-y-6">
          <FileUpload
            label="Profile Image"
            accept="image/png,image/jpeg,image/webp"
            note="JPG / PNG / WEBP • up to 2 MB"
            file={form.profileImage}
            onChange={(file) => setForm({ ...form, profileImage: file })}
          />
          <FileUpload
            label="Intro Video (optional)"
            accept="video/mp4,video/webm,video/quicktime"
            note="MP4 / WEBM / MOV • up to 20 MB"
            file={form.introVideo}
            onChange={(file) => setForm({ ...form, introVideo: file })}
          />
        </div>
      )}

      {/* Step 3: Education */}
      {step === 3 && (
        <div className="space-y-6">
          <label className="block text-sm font-semibold">Education</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Degree, Institution, Year"
            onChange={(e) =>
              setForm({
                ...form,
                education: [{ degree: e.target.value, institution: "", year: "" }],
              })
            }
          />

          <FileUpload
            label="Certificates (PDF/Image)"
            accept=".pdf,image/*"
            file={form.certificates[0].file}
            onChange={(file) =>
              setForm({
                ...form,
                certificates: [{ ...form.certificates[0], file }],
              })
            }
          />
        </div>
      )}

      {/* Step 4: Skills & Portfolio */}
      {step === 4 && (
        <div className="space-y-6">
          <label className="block text-sm font-semibold">Skills</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Solidity, React, Hardhat"
            onChange={(e) =>
              setForm({ ...form, skills: e.target.value.split(",").map((s) => s.trim()) })
            }
          />

          <FileUpload
            label="Portfolio Image"
            accept="image/*"
            file={form.portfolio[0].image}
            onChange={(file) =>
              setForm({
                ...form,
                portfolio: [{ ...form.portfolio[0], image: file }],
              })
            }
          />
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Project link (https://...)"
            onChange={(e) =>
              setForm({
                ...form,
                portfolio: [{ ...form.portfolio[0], link: e.target.value }],
              })
            }
          />
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Review your details:</p>
          <p><strong>Name:</strong> {form.name}</p>
          <p><strong>Headline:</strong> {form.headline}</p>
          <p><strong>Bio:</strong> {form.bio}</p>
          <p><strong>Skills:</strong> {form.skills.join(", ")}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        {step > 1 && (
          <button onClick={back} className="px-4 py-2 border border-border rounded-lg">
            Back
          </button>
        )}
        {step < 5 && (
          <button
            onClick={next}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            Next
          </button>
        )}
        {step === 5 && (
          <button
            disabled={loading || uploading}
            onClick={handleSaveProfile}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            {loading || uploading ? progress || "Saving..." : isUpdating ? "Update Profile" : "Publish Profile"}
          </button>
        )}
      </div>

      {msg && <p className="text-sm mt-3 text-foreground-secondary">{msg}</p>}
    </div>
  );
}
