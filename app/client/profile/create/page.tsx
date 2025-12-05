"use client";

import { useEffect, useState } from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from "thirdweb";
import { client } from "@/lib/thirdweb-client";
import { CHAIN } from "@/lib/chains";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { useRouter } from "next/navigation";
import { Loader2, Upload, AlertCircle } from "lucide-react";
import { useIPFSUpload } from "@/hooks/useIPFSUpload";
import { ipfsToHttp } from "@/utils/ipfs";

export default function CreateClientProfilePage() {
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  // Check if MetaMask is connected - profile creation requires smart wallet for gas sponsorship
  const isMetaMask = activeWallet?.id === "io.metamask";
  
  // Use active account only if it's NOT MetaMask (i.e., it's the smart wallet)
  const safeAccount = isMetaMask ? null : activeAccount;

  const { uploadFile, uploading, progress } = useIPFSUpload();

  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    bio: "",
    company: "",
    profileImage: "", // IPFS URI
  });

  const handleChange = (e: any) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  /* ---------------------------------------
      1) LOAD EXISTING PROFILE
  --------------------------------------- */
  useEffect(() => {
    if (!safeAccount) return;

    async function load() {
      try {
        setLoading(true);

        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
        });

        if (!safeAccount) return;
const account = safeAccount; // Narrowing

const pAddr = await readContract({
  contract: factory,
  method: "function clientProfiles(address) view returns (address)",
  params: [account.address as `0x${string}`],
});

        if (pAddr && pAddr !== "0x0000000000000000000000000000000000000000") {
          setProfileAddress(pAddr);

          const profileContract = getContract({
            client,
            chain: CHAIN,
            address: pAddr as `0x${string}`,
          });

          const [name, bio, company, profileImage] = await Promise.all([
            readContract({
              contract: profileContract,
              method: "function name() view returns (string)",
            }),
            readContract({
              contract: profileContract,
              method: "function bio() view returns (string)",
            }),
            readContract({
              contract: profileContract,
              method: "function company() view returns (string)",
            }),
            readContract({
              contract: profileContract,
              method: "function profileImage() view returns (string)",
            }),
          ]);

          setForm({ name, bio, company, profileImage });
        }
      } catch (err) {
        console.error("❌ Profile load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [safeAccount]);

  /* ---------------------------------------
      2) IMAGE UPLOAD HANDLER
  --------------------------------------- */
  const handleImageUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uri = await uploadFile(file); // returns ipfs://xyz
      setForm((prev) => ({ ...prev, profileImage: uri }));
    } catch (err) {
      console.error("❌ Image upload failed:", err);
      alert("Image upload failed");
    }
  };

  /* ---------------------------------------
      3) SAVE PROFILE
  --------------------------------------- */
  const saveProfile = async () => {
    if (!safeAccount) return alert("Connect wallet first");

    try {
      setLoading(true);

      if (!profileAddress) {
        // CREATE NEW
        const factory = getContract({
          client,
          chain: CHAIN,
          address: DEPLOYED_CONTRACTS.addresses.ClientFactory,
        });

        const tx = await prepareContractCall({
          contract: factory,
          method:
            "function createClientProfile(string,string,string,string)",
          params: [
            form.name,
            form.bio,
            form.company,
            form.profileImage,
          ],
        });

        await sendTransaction({ transaction: tx, account: safeAccount });
      } else {
        // UPDATE EXISTING
        const profileContract = getContract({
          client,
          chain: CHAIN,
          address: profileAddress as `0x${string}`,
        });

        const tx = await prepareContractCall({
          contract: profileContract,
          method:
            "function updateProfile(string,string,string,string)",
          params: [
            form.name,
            form.bio,
            form.company,
            form.profileImage,
          ],
        });

        await sendTransaction({ transaction: tx, account: safeAccount });
      }

      router.push("/client/profile");
    } catch (err) {
      console.error("❌ Save failed:", err);
      alert("Save failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------
      4) UI
  --------------------------------------- */

  if (isMetaMask)
    return (
      <section className="p-6 max-w-2xl mx-auto">
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold">MetaMask Detected</h2>
          </div>
          <p className="text-foreground-secondary">
            Profile creation requires the gas-sponsored smart wallet. Please disconnect MetaMask and sign in with Google or Email to use the smart wallet.
          </p>
          <p className="text-sm text-foreground-secondary">
            The smart wallet provides gas sponsorship, so you won't need to pay for transaction fees.
          </p>
          {activeWallet && (
            <button
              onClick={() => disconnect(activeWallet)}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              Disconnect MetaMask
            </button>
          )}
        </div>
      </section>
    );

  if (!safeAccount)
    return (
      <section className="p-6 text-center text-lg">Connect wallet to continue.</section>
    );

  if (loading)
    return (
      <section className="p-6 flex justify-center">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </section>
    );

  return (
    <section className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold">
        {profileAddress ? "Edit Client Profile" : "Create Client Profile"}
      </h1>

      {/* IMAGE UPLOAD */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Profile Image</label>

        <div className="flex flex-col items-center gap-4">
          {/* Preview */}
          {form.profileImage ? (
            <img
              src={ipfsToHttp(form.profileImage)}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border border-border shadow"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border">
              No Image
            </div>
          )}

          {/* Upload Button */}
          <label
            className="
              px-4 py-2 rounded-lg bg-primary text-primary-foreground
              cursor-pointer flex items-center gap-2 hover:opacity-90
            "
          >
            <Upload className="w-4 h-4" />
            {uploading ? progress : "Upload Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        </div>
      </div>

      {/* TEXT FIELDS */}
      <div className="space-y-4">
        {["name", "bio", "company"].map((field) => (
          <div key={field} className="w-full">
            <label className="capitalize mb-1 block text-sm font-medium">
              {field}
            </label>
            <input
              name={field}
              value={(form as any)[field]}
              onChange={handleChange}
              className="
                w-full p-3 rounded-xl bg-surface border border-border
                focus:ring-2 focus:ring-primary outline-none
              "
              placeholder={`Enter ${field}`}
            />
          </div>
        ))}
      </div>

      {/* SAVE BUTTON */}
      <button
        onClick={saveProfile}
        disabled={loading || uploading}
        className="
          w-full px-4 py-2 
          bg-primary text-primary-foreground 
          rounded-xl hover:opacity-90 transition 
          font-medium disabled:opacity-50
        "
      >
        {loading || uploading ? "Saving..." : "Save Profile"}
      </button>
    </section>
  );
}
