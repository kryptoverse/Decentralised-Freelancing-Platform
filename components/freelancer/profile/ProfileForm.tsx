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

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.headline.trim()) newErrors.headline = "Professional headline is required";
    if (!form.bio.trim()) newErrors.bio = "Professional summary is required";
    if (!form.profileImage) newErrors.profileImage = "Profile image is required";

    if (form.skills.length === 0 || (form.skills.length === 1 && form.skills[0] === "")) {
      newErrors.skills = "At least one skill is required";
    }

    // Check at least one valid education
    const validEducation = form.education.some(e => e.degree.trim() && e.institution.trim());
    if (!validEducation) {
      newErrors.education = "At least one education entry is required";
    }

    // Check at least one valid experience
    const validExperience = form.experience.some(e => e.title.trim() && e.company.trim());
    if (!validExperience) {
      newErrors.experience = "At least one work experience entry is required";
    }

    // Check at least one valid portfolio
    const validPortfolio = form.portfolio.some(p => p.title.trim());
    if (!validPortfolio) {
      newErrors.portfolio = "At least one portfolio project is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      setMsg("⚠️ Please connect your wallet first.");
      return;
    }

    if (!validate()) {
      setMsg("❌ Please fix the validation errors above.");
      // Scroll to top to see errors
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Shared input class
  const inputBase = "w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-muted-foreground/60";
  const inputError = "border-red-400 focus:ring-red-400/40 focus:border-red-400";
  const inputNormal = "border-border";
  const sectionCard = "rounded-2xl border border-border bg-surface p-4 sm:p-6 space-y-4";
  const sectionTitle = "text-base sm:text-lg font-semibold flex items-center gap-2";
  const entryCard = "rounded-xl border border-border/60 bg-surface-secondary/50 p-3 sm:p-4 space-y-3";
  const addBtn = "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/8 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/15 transition-colors";
  const removeBtn = "text-xs font-medium text-red-500 hover:text-red-600 hover:underline transition-colors";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-3xl mx-auto space-y-5 sm:space-y-6"
    >
      {/* ===== FORM HEADER ===== */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">
          {profileAddress ? "Edit Profile" : "Create Profile"}
        </h2>
        {uploading && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse">
            {progress || "Uploading..."}
          </span>
        )}
      </div>

      {/* ===== BASIC INFO SECTION ===== */}
      <div className={sectionCard}>
        <h3 className={sectionTitle}>
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">1</span>
          Basic Information
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Your name or brand"
              className={`${inputBase} ${errors.name ? inputError : inputNormal}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
          </div>

          {/* Headline */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Professional Headline <span className="text-red-500">*</span>
            </label>
            <input
              name="headline"
              value={form.headline}
              onChange={handleChange}
              placeholder="Web3 Developer | Solidity Expert | Full-Stack Developer"
              className={`${inputBase} ${errors.headline ? inputError : inputNormal}`}
            />
            {errors.headline && <p className="text-xs text-red-500 mt-1.5">{errors.headline}</p>}
            <p className="text-xs text-muted-foreground mt-1.5">
              A short tagline that appears below your name (e.g., &quot;Senior Blockchain Developer&quot;)
            </p>
          </div>

          {/* Bio / Summary */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Professional Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              name="bio"
              rows={5}
              value={form.bio}
              onChange={handleChange}
              placeholder="Write a compelling summary about your experience, skills, and what makes you unique. This is your chance to stand out to potential clients..."
              className={`${inputBase} resize-none ${errors.bio ? inputError : inputNormal}`}
            />
            {errors.bio && <p className="text-xs text-red-500 mt-1.5">{errors.bio}</p>}
            <p className="text-xs text-muted-foreground mt-1.5">
              {form.bio.length}/500 characters (recommended: 150-300 words)
            </p>
          </div>
        </div>
      </div>

      {/* ===== MEDIA SECTION ===== */}
      <div className={sectionCard}>
        <h3 className={sectionTitle}>
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">2</span>
          Profile Media
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Profile Image */}
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <label className="block text-sm font-medium">
              Profile Image <span className="text-red-500">*</span>
            </label>
            {form.profileImage ? (
              <div className="flex items-center gap-3">
                <img
                  src={ipfsToHttp(form.profileImage)}
                  className="w-20 h-20 rounded-xl border border-border object-cover flex-shrink-0"
                  alt="Profile"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-2 truncate">Image uploaded</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "profileImage")} className="text-xs w-full" />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center h-20 rounded-lg bg-surface-secondary mb-2">
                  <span className="text-xs text-muted-foreground">No image uploaded</span>
                </div>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "profileImage")} className="text-xs w-full" />
              </div>
            )}
            {errors.profileImage && <p className="text-xs text-red-500">{errors.profileImage}</p>}
          </div>

          {/* Intro Video */}
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <label className="block text-sm font-medium">Intro Video</label>
            {form.introVideo ? (
              <div className="space-y-2">
                <video
                  src={ipfsToHttp(form.introVideo)}
                  controls
                  className="rounded-lg border border-border w-full max-h-36"
                />
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleFileUpload(e, "introVideo")}
                  className="text-xs w-full"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center h-20 rounded-lg bg-surface-secondary mb-2">
                  <span className="text-xs text-muted-foreground">No video uploaded</span>
                </div>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => handleFileUpload(e, "introVideo")}
                  className="text-xs w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== SKILLS SECTION ===== */}
      <div className={sectionCard}>
        <h3 className={sectionTitle}>
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">3</span>
          Skills
        </h3>
        <div>
          <input
            value={form.skills.join(", ")}
            onChange={(e) => setForm({ ...form, skills: e.target.value.split(",").map((s) => s.trim()) })}
            placeholder="Solidity, React, Node.js"
            className={`${inputBase} ${errors.skills ? inputError : inputNormal}`}
          />
          {errors.skills && <p className="text-xs text-red-500 mt-1.5">{errors.skills}</p>}
          <p className="text-xs text-muted-foreground mt-1.5">Separate skills with commas</p>
          {form.skills.length > 0 && form.skills[0] !== "" && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.skills.filter(Boolean).map((s, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary/8 border border-primary/20 text-primary">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== EDUCATION SECTION ===== */}
      <div className={sectionCard}>
        <h3 className={sectionTitle}>
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">4</span>
          Education
        </h3>
        {errors.education && <p className="text-sm text-red-500">{errors.education}</p>}

        <div className="space-y-3">
          {(form.education || []).map((edu, i) => (
            <div key={i} className={entryCard}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Education #{i + 1}</span>
                {(form.education || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...(form.education || [])];
                      arr.splice(i, 1);
                      setForm((prev) => ({ ...prev, education: arr }));
                    }}
                    className={removeBtn}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                value={edu.degree}
                onChange={(e) => updateArray("education", i, "degree", e.target.value)}
                placeholder="Degree (e.g. Bachelor of Science in Computer Science)"
                className={`${inputBase} ${inputNormal}`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={edu.institution}
                  onChange={(e) => updateArray("education", i, "institution", e.target.value)}
                  placeholder="Institution Name"
                  className={`${inputBase} ${inputNormal}`}
                />
                <input
                  value={edu.year}
                  onChange={(e) => updateArray("education", i, "year", e.target.value)}
                  placeholder="Graduation Year"
                  className={`${inputBase} ${inputNormal}`}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addToArray("education", { degree: "", institution: "", year: "" })}
          className={addBtn}
        >
          + Add Education
        </button>
      </div>

      {/* ===== EXPERIENCE SECTION ===== */}
      <div className={sectionCard}>
        <h3 className={sectionTitle}>
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">5</span>
          Work Experience
        </h3>
        {errors.experience && <p className="text-sm text-red-500">{errors.experience}</p>}

        <div className="space-y-3">
          {(form.experience || []).map((exp, i) => (
            <div key={i} className={entryCard}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience #{i + 1}</span>
                {(form.experience || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...(form.experience || [])];
                      arr.splice(i, 1);
                      setForm((prev) => ({ ...prev, experience: arr }));
                    }}
                    className={removeBtn}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                value={exp.title}
                onChange={(e) => updateArray("experience", i, "title", e.target.value)}
                placeholder="Job Title (e.g. Senior Web Developer)"
                className={`${inputBase} ${inputNormal}`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={exp.company}
                  onChange={(e) => updateArray("experience", i, "company", e.target.value)}
                  placeholder="Company Name"
                  className={`${inputBase} ${inputNormal}`}
                />
                <input
                  value={exp.duration}
                  onChange={(e) => updateArray("experience", i, "duration", e.target.value)}
                  placeholder="Duration (e.g. Jan 2020 - Dec 2023)"
                  className={`${inputBase} ${inputNormal}`}
                />
              </div>
              <textarea
                value={exp.description}
                onChange={(e) => updateArray("experience", i, "description", e.target.value)}
                placeholder="Describe your role, responsibilities, and achievements..."
                rows={3}
                className={`${inputBase} ${inputNormal} resize-none`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addToArray("experience", { title: "", company: "", duration: "", description: "" })}
          className={addBtn}
        >
          + Add Experience
        </button>
      </div>

      {/* ===== CERTIFICATES SECTION ===== */}
      <div className={sectionCard}>
        <h3 className={sectionTitle}>
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">6</span>
          Certificates &amp; Credentials
        </h3>

        <div className="space-y-3">
          {(form.certificates || []).map((cert, i) => (
            <div key={i} className={entryCard}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Certificate #{i + 1}</span>
                {(form.certificates || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...(form.certificates || [])];
                      arr.splice(i, 1);
                      setForm((prev) => ({ ...prev, certificates: arr }));
                    }}
                    className={removeBtn}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                value={cert.title}
                onChange={(e) => updateArray("certificates", i, "title", e.target.value)}
                placeholder="Certificate Title (e.g. AWS Certified Solutions Architect)"
                className={`${inputBase} ${inputNormal}`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={cert.issuer}
                  onChange={(e) => updateArray("certificates", i, "issuer", e.target.value)}
                  placeholder="Issuing Organization"
                  className={`${inputBase} ${inputNormal}`}
                />
                <input
                  value={cert.year}
                  onChange={(e) => updateArray("certificates", i, "year", e.target.value)}
                  placeholder="Year Earned"
                  className={`${inputBase} ${inputNormal}`}
                />
              </div>
              <div className="rounded-lg border border-dashed border-border p-3">
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Certificate File (PDF/Document)</label>
                {cert.file && (
                  <a
                    href={ipfsToHttp(cert.file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mb-2 block font-medium"
                  >
                    View Current Certificate &rarr;
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
                  className="text-xs w-full"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addToArray("certificates", { title: "", issuer: "", year: "", file: "" })}
          className={addBtn}
        >
          + Add Certificate
        </button>
      </div>

      {/* ===== PORTFOLIO SECTION ===== */}
      <div className={sectionCard}>
        <div>
          <h3 className={sectionTitle}>
            <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">7</span>
            Portfolio Projects
          </h3>
          <p className="text-xs text-muted-foreground mt-1 ml-8">
            Showcase your best work with images, descriptions, and links to live projects.
          </p>
        </div>
        {errors.portfolio && <p className="text-sm text-red-500">{errors.portfolio}</p>}

        <div className="space-y-3">
          {(form.portfolio || []).map((item, i) => (
            <div key={i} className={entryCard}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project #{i + 1}</span>
                {(form.portfolio || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...(form.portfolio || [])];
                      arr.splice(i, 1);
                      setForm((prev) => ({ ...prev, portfolio: arr }));
                    }}
                    className={removeBtn}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                value={item.title}
                onChange={(e) => updateArray("portfolio", i, "title", e.target.value)}
                placeholder="Project Title (e.g. E-commerce Platform)"
                className={`${inputBase} ${inputNormal}`}
              />
              <textarea
                value={item.description}
                onChange={(e) => updateArray("portfolio", i, "description", e.target.value)}
                placeholder="Describe the project, technologies used, and your role..."
                rows={3}
                className={`${inputBase} ${inputNormal} resize-none`}
              />
              <input
                value={item.link || ""}
                onChange={(e) => updateArray("portfolio", i, "link", e.target.value)}
                placeholder="Live Project URL (e.g. https://example.com)"
                className={`${inputBase} ${inputNormal}`}
              />
              <div className="rounded-lg border border-dashed border-border p-3">
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Project Image/Thumbnail</label>
                {item.image ? (
                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={ipfsToHttp(item.image)}
                      alt={item.title || "Portfolio"}
                      className="w-20 h-20 object-cover rounded-lg border border-border flex-shrink-0"
                    />
                    <p className="text-xs text-muted-foreground">Image uploaded</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-16 rounded-lg bg-surface-secondary mb-2">
                    <span className="text-xs text-muted-foreground">No image uploaded</span>
                  </div>
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
                  className="text-xs w-full"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addToArray("portfolio", { title: "", description: "", link: "", image: "" })}
          className={addBtn}
        >
          + Add Portfolio Project
        </button>
      </div>

      {/* ===== SUBMIT SECTION ===== */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 space-y-3">
        <button
          disabled={loading || uploading}
          type="submit"
          className="w-full py-3 rounded-xl gradient-primary text-white font-semibold text-sm sm:text-base hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading || uploading ? progress || "Saving..." : profileAddress ? "Update Profile" : "Create Profile"}
        </button>

        {msg && (
          <p className={`text-sm text-center ${msg.includes("❌") || msg.includes("⚠️") ? "text-red-500" : "text-foreground-secondary"}`}>
            {msg}
          </p>
        )}
      </div>
    </form>
  );
}
