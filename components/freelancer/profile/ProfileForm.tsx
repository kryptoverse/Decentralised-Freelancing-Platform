"use client";

import { useEffect, useState } from "react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { ipfsToHttp } from "@/utils/ipfs";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

interface Metadata {
  name: string;
  headline: string;
  bio: string;
  profileImage?: string;
  introVideo?: string;
  skills: string[];
  education: { degree: string; institution: string; year: string }[];
  experience: { title: string; company: string; duration: string; description: string }[];
  certificates: { title: string; issuer: string; year: string; file?: string }[];
  portfolio: { title: string; description: string; link?: string; image?: string }[];
}

interface FreelancerProfileFormProps {
  profileAddress?: string; // if passed => edit mode
  existingMetadata?: Metadata | null;
  onSaved?: (uri: string) => void;
}

export function FreelancerProfileForm({
  profileAddress,
  existingMetadata,
  onSaved,
}: FreelancerProfileFormProps) {
  const account = useActiveAccount();
  const { uploadFile, uploadMetadata, uploading, progress } = useIPFSUpload();

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<Metadata>({
    name: "",
    headline: "",
    bio: "",
    profileImage: "",
    introVideo: "",
    skills: [],
    education: [{ degree: "", institution: "", year: "" }],
    experience: [{ title: "", company: "", duration: "", description: "" }],
    certificates: [{ title: "", issuer: "", year: "", file: "" }],
    portfolio: [{ title: "", description: "", link: "", image: "" }],
  });

  useEffect(() => {
    if (existingMetadata) {
      setForm((prev) => ({
        ...prev,
        ...existingMetadata,
        skills: existingMetadata.skills ?? [],
        education: existingMetadata.education ?? [{ degree: "", institution: "", year: "" }],
        experience: existingMetadata.experience ?? [{ title: "", company: "", duration: "", description: "" }],
        certificates: existingMetadata.certificates ?? [{ title: "", issuer: "", year: "", file: "" }],
        portfolio: existingMetadata.portfolio ?? [{ title: "", description: "", link: "", image: "" }],
      }));
    }
  }, [existingMetadata]);

  // Delete old file
  const deleteFromIPFS = async (uri?: string) => {
    if (!uri || !uri.startsWith("ipfs://")) return;
    const cid = uri.replace("ipfs://", "");
    await fetch("/api/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid }),
    });
  };

  // File upload (image/video/docs)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: keyof Metadata
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(`📤 Uploading ${file.name}...`);
    if (typeof form[key] === "string" && form[key]) {
      await deleteFromIPFS(form[key] as string);
    }

    const prevCid = typeof form[key] === "string" && (form[key] as string)?.startsWith("ipfs://")
      ? (form[key] as string).replace("ipfs://", "")
      : undefined;
    
    // ✅ Create descriptive filename: wallet_address-type.ext
    // Remove 0x prefix and sanitize for filename (first 10 chars)
    const walletPrefix = account?.address 
      ? account.address.replace('0x', '').toLowerCase().slice(0, 10) 
      : 'user';
    
    // Convert camelCase to kebab-case: profileImage -> profile-image, introVideo -> intro-video
    const fieldName = String(key)
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, ''); // Remove leading dash if any
    
    // Get original file extension
    const fileExt = file.name.split('.').pop() || '';
    const nameHint = `${walletPrefix}_${fieldName}.${fileExt}`;
    
    const uri = await uploadFile(file, { name: nameHint, previousCid: prevCid });
    setForm((prev) => ({ ...prev, [key]: uri }));
    setMsg(`✅ ${file.name} uploaded`);
  };

  const handleChange = (e: any) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const updateArray = (field: keyof Metadata, i: number, key: string, value: string) => {
    const arr = [...(form[field] as any[])];
    arr[i][key] = value;
    setForm((prev) => ({ ...prev, [field]: arr }));
  };

  const addToArray = (field: keyof Metadata, template: any) =>
    setForm((prev) => ({ ...prev, [field]: [...(form[field] as any[]), template] }));

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setMsg("⚠️ Please connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      setMsg("🚀 Uploading metadata to IPFS...");

      // If editing, read previous profileURI from chain to unpin it
      let previousCid: string | undefined;
      if (profileAddress) {
        try {
          const profile = getContract({ client, chain: CHAIN, address: profileAddress as `0x${string}` });
          const currentUri = await (await import("thirdweb")).readContract<any, any>({
            contract: profile as any,
            method: "function profileURI() view returns (string)",
          });
          if (typeof currentUri === "string" && currentUri.startsWith("ipfs://")) {
            previousCid = currentUri.replace("ipfs://", "");
          }
        } catch (e) {
          console.warn("Failed to fetch existing profileURI (continuing):", e);
        }
      }

      // ✅ Create descriptive metadata filename: wallet_address-profile.json
      const walletPrefix = account.address.replace('0x', '').toLowerCase().slice(0, 10);
      const metadataName = `${walletPrefix}_profile-metadata`;
      
      const metadataURI = await uploadMetadata(form, {
        name: metadataName,
        previousCid,
      });

      if (profileAddress) {
        // ✅ Check if URI actually changed before updating on-chain
        const contract = getContract({ client, chain: CHAIN, address: profileAddress as `0x${string}` });
        const { readContract } = await import("thirdweb");
        const currentUri = await readContract<any, any>({
          contract: contract as any,
          method: "function profileURI() view returns (string)",
        });
        
        // Only update if URI changed or name/bio changed
        const currentName = await readContract<any, any>({
          contract: contract as any,
          method: "function name() view returns (string)",
        });
        const currentBio = await readContract<any, any>({
          contract: contract as any,
          method: "function bio() view returns (string)",
        });

        const uriChanged = currentUri !== metadataURI;
        const nameChanged = currentName !== form.name;
        const bioChanged = currentBio !== form.bio;

        if (uriChanged || nameChanged || bioChanged) {
          const tx = await prepareContractCall({
            contract,
            method: "function updateProfile(string,string,string)",
            params: [form.name, form.bio, metadataURI],
          });
          await sendTransaction({ account, transaction: tx });
          setMsg("✅ Profile updated successfully!");
        } else {
          setMsg("✅ Profile saved (no changes to update on-chain)");
        }
      } else {
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.FreelancerFactory as `0x${string}`,
        });
        const tx = await prepareContractCall({
          contract: factory,
          method: "function deployFreelancerProfile(string,string,string) returns (address)",
          params: [form.name, form.bio, metadataURI],
        });
        await sendTransaction({ account, transaction: tx });
        setMsg("✅ Profile created successfully!");
      }

      onSaved?.(metadataURI);
    } catch (err) {
      console.error(err);
      setMsg("❌ Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="
        w-full max-w-3xl mx-auto
        p-4 md:p-6
        rounded-2xl glass-effect border border-border shadow-md 
        space-y-6
      "
    >
      <h2 className="text-2xl font-bold text-primary">
        {profileAddress ? "Edit Profile" : "Create Freelancer Profile"}
      </h2>

      {/* Basic Info */}
      <div>
        <label className="block text-sm mb-1 font-medium">Name</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          placeholder="Your name or brand"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Professional Headline</label>
        <input
          name="headline"
          value={form.headline}
          onChange={handleChange}
          placeholder="Web3 Developer | Solidity Expert | Full-Stack Developer"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-foreground-secondary mt-1">
          A short tagline that appears below your name (e.g., "Senior Blockchain Developer")
        </p>
      </div>

      <div>
        <label className="block text-sm mb-1 font-medium">Professional Summary</label>
        <textarea
          name="bio"
          rows={5}
          value={form.bio}
          onChange={handleChange}
          placeholder="Write a compelling summary about your experience, skills, and what makes you unique. This is your chance to stand out to potential clients..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
        <p className="text-xs text-foreground-secondary mt-1">
          {form.bio.length}/500 characters (recommended: 150-300 words)
        </p>
      </div>

      {/* Profile Media */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 w-full">
        <div className="flex-1">
          <label className="block text-sm mb-1 font-medium">Profile Image</label>
          {form.profileImage && (
            <img
              src={ipfsToHttp(form.profileImage)}
              className="w-32 h-32 rounded-xl border border-border object-cover mb-2"
              alt="Profile"
            />
          )}
          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "profileImage")} />
        </div>

        <div className="flex-1">
          <label className="block text-sm mb-1 font-medium">Intro Video</label>
          {form.introVideo && (
            <video
              src={ipfsToHttp(form.introVideo)}
              controls
              className="rounded-xl border border-border w-full max-h-48 mb-2"
            />
          )}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => handleFileUpload(e, "introVideo")}
          />
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="block text-sm mb-1 font-medium">Skills</label>
        <input
          value={form.skills.join(", ")}
          onChange={(e) => setForm({ ...form, skills: e.target.value.split(",").map((s) => s.trim()) })}
          placeholder="Solidity, React, Node.js"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
        />
      </div>

      {/* Education */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Education</h3>
        {(form.education || []).map((edu, i) => (
          <div key={i} className="space-y-2 mb-3 p-4 rounded-lg border border-border bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground-secondary">Education #{i + 1}</span>
              {(form.education || []).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const arr = [...(form.education || [])];
                    arr.splice(i, 1);
                    setForm((prev) => ({ ...prev, education: arr }));
                  }}
                  className="text-xs text-error hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={edu.degree}
              onChange={(e) => updateArray("education", i, "degree", e.target.value)}
              placeholder="Degree (e.g. Bachelor of Science in Computer Science)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <input
              value={edu.institution}
              onChange={(e) => updateArray("education", i, "institution", e.target.value)}
              placeholder="Institution Name (e.g. MIT, Stanford University)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <input
              value={edu.year}
              onChange={(e) => updateArray("education", i, "year", e.target.value)}
              placeholder="Graduation Year (e.g. 2020)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => addToArray("education", { degree: "", institution: "", year: "" })}
          className="px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary transition text-sm font-medium"
        >
          + Add Education
        </button>
      </div>

      {/* Experience */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Work Experience</h3>
        {(form.experience || []).map((exp, i) => (
          <div key={i} className="space-y-2 mb-3 p-4 rounded-lg border border-border bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground-secondary">Experience #{i + 1}</span>
              {(form.experience || []).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const arr = [...(form.experience || [])];
                    arr.splice(i, 1);
                    setForm((prev) => ({ ...prev, experience: arr }));
                  }}
                  className="text-xs text-error hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={exp.title}
              onChange={(e) => updateArray("experience", i, "title", e.target.value)}
              placeholder="Job Title (e.g. Senior Web Developer)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <input
              value={exp.company}
              onChange={(e) => updateArray("experience", i, "company", e.target.value)}
              placeholder="Company Name"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <input
              value={exp.duration}
              onChange={(e) => updateArray("experience", i, "duration", e.target.value)}
              placeholder="Duration (e.g. Jan 2020 - Dec 2023)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <textarea
              value={exp.description}
              onChange={(e) => updateArray("experience", i, "description", e.target.value)}
              placeholder="Describe your role, responsibilities, and achievements..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-none"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => addToArray("experience", { title: "", company: "", duration: "", description: "" })}
          className="px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary transition text-sm font-medium"
        >
          + Add Experience
        </button>
      </div>

      {/* Certificates */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Certificates & Credentials</h3>
        {(form.certificates || []).map((cert, i) => (
          <div key={i} className="space-y-2 mb-3 p-4 rounded-lg border border-border bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground-secondary">Certificate #{i + 1}</span>
              {(form.certificates || []).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const arr = [...(form.certificates || [])];
                    arr.splice(i, 1);
                    setForm((prev) => ({ ...prev, certificates: arr }));
                  }}
                  className="text-xs text-error hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={cert.title}
              onChange={(e) => updateArray("certificates", i, "title", e.target.value)}
              placeholder="Certificate Title (e.g. AWS Certified Solutions Architect)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <input
              value={cert.issuer}
              onChange={(e) => updateArray("certificates", i, "issuer", e.target.value)}
              placeholder="Issuing Organization (e.g. Amazon Web Services)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <input
              value={cert.year}
              onChange={(e) => updateArray("certificates", i, "year", e.target.value)}
              placeholder="Year Earned (e.g. 2023)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <div>
              <label className="block text-sm mb-1 font-medium">Certificate File (PDF/Document)</label>
              {cert.file && (
                <a
                  href={ipfsToHttp(cert.file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mb-2 block"
                >
                  View Current Certificate →
                </a>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setMsg(`📤 Uploading certificate ${file.name}...`);
                  const prevCid = cert.file?.startsWith("ipfs://")
                    ? cert.file.replace("ipfs://", "")
                    : undefined;
                  const walletPrefix = account?.address 
                    ? account.address.replace('0x', '').toLowerCase().slice(0, 10) 
                    : 'user';
                  const nameHint = `${walletPrefix}_certificate-${i + 1}`;
                  const uri = await uploadFile(file, { name: nameHint, previousCid: prevCid });
                  updateArray("certificates", i, "file", uri);
                  setMsg(`✅ Certificate uploaded`);
                }}
                className="w-full text-sm"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addToArray("certificates", { title: "", issuer: "", year: "", file: "" })}
          className="px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary transition text-sm font-medium"
        >
          + Add Certificate
        </button>
      </div>

      {/* Portfolio */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Portfolio Projects</h3>
        <p className="text-sm text-foreground-secondary mb-4">
          Showcase your best work with images, descriptions, and links to live projects.
        </p>
        {(form.portfolio || []).map((item, i) => (
          <div key={i} className="space-y-2 mb-4 p-4 rounded-lg border border-border bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground-secondary">Project #{i + 1}</span>
              {(form.portfolio || []).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const arr = [...(form.portfolio || [])];
                    arr.splice(i, 1);
                    setForm((prev) => ({ ...prev, portfolio: arr }));
                  }}
                  className="text-xs text-error hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={item.title}
              onChange={(e) => updateArray("portfolio", i, "title", e.target.value)}
              placeholder="Project Title (e.g. E-commerce Platform)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <textarea
              value={item.description}
              onChange={(e) => updateArray("portfolio", i, "description", e.target.value)}
              placeholder="Describe the project, technologies used, and your role..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-none"
            />
            <input
              value={item.link || ""}
              onChange={(e) => updateArray("portfolio", i, "link", e.target.value)}
              placeholder="Live Project URL (e.g. https://example.com)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
            />
            <div>
              <label className="block text-sm mb-1 font-medium">Project Image/Thumbnail</label>
              {item.image && (
                <img
                  src={ipfsToHttp(item.image)}
                  alt={item.title || "Portfolio"}
                  className="w-32 h-32 object-cover rounded-lg mb-2 border border-border"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setMsg(`📤 Uploading project image ${file.name}...`);
                  const prevCid = item.image?.startsWith("ipfs://")
                    ? item.image.replace("ipfs://", "")
                    : undefined;
                  const walletPrefix = account?.address 
                    ? account.address.replace('0x', '').toLowerCase().slice(0, 10) 
                    : 'user';
                  const nameHint = `${walletPrefix}_portfolio-project-${i + 1}`;
                  const uri = await uploadFile(file, { name: nameHint, previousCid: prevCid });
                  updateArray("portfolio", i, "image", uri);
                  setMsg(`✅ Image uploaded`);
                }}
                className="w-full text-sm"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addToArray("portfolio", { title: "", description: "", link: "", image: "" })}
          className="px-4 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary transition text-sm font-medium"
        >
          + Add Portfolio Project
        </button>
      </div>

      <button
        disabled={loading || uploading}
        type="submit"
        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition w-full font-medium"
      >
        {loading || uploading ? progress || "Saving..." : "Save Profile"}
      </button>

      {msg && <p className="text-sm text-foreground-secondary">{msg}</p>}
    </form>
  );
}
