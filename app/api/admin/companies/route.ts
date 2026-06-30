import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";
import { ipfsToHttp } from "@/utils/ipfs";

const COMPANY_REGISTRY_ABI = [
  "function getCompanyCount() view returns (uint256)",
  "function getCompany(uint256) view returns (tuple(address owner,address token,address sale,address vault,address distributor,string metadataURI,string sector,bool exists))",
];

function getProvider() {
  const infuraKey = process.env.INFURA_API_KEY;
  return new ethers.providers.StaticJsonRpcProvider(
    {
      url: infuraKey
        ? `https://polygon-amoy.infura.io/v3/${infuraKey}`
        : "https://rpc-amoy.polygon.technology/",
      skipFetchSetup: true,
    },
    80002
  );
}

async function fetchCompanyMetadata(metadataURI: string) {
  if (!metadataURI) return null;

  try {
    const res = await fetch(ipfsToHttp(metadataURI), { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = req.cookies.get("admin_session");
    if (session?.value !== "authenticated") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const registryAddress = DEPLOYED_CONTRACTS.addresses.CompanyRegistry;
    if (!registryAddress) {
      return NextResponse.json(
        { success: false, error: "CompanyRegistry address is not configured" },
        { status: 500 }
      );
    }

    const registry = new ethers.Contract(
      registryAddress,
      COMPANY_REGISTRY_ABI,
      getProvider()
    );

    const countBN: ethers.BigNumber = await registry.getCompanyCount();
    const count = countBN.toNumber();

    const companies = await Promise.all(
      Array.from({ length: count }, async (_, index) => {
        const id = index + 1;

        try {
          const company = await registry.getCompany(id);
          const meta = await fetchCompanyMetadata(company.metadataURI);

          return {
            id,
            owner: company.owner,
            token: company.token,
            sale: company.sale,
            vault: company.vault,
            distributor: company.distributor,
            metadataURI: company.metadataURI,
            sector: company.sector,
            exists: company.exists,
            name: meta?.name || `Company #${id}`,
            symbol: meta?.symbol || "",
            description: meta?.description || "",
            image: meta?.image || "",
          };
        } catch (error: any) {
          console.error(`Error fetching company ${id}:`, error);
          return {
            id,
            owner: "",
            token: "",
            sale: "",
            vault: "",
            distributor: "",
            metadataURI: "",
            sector: "",
            exists: false,
            name: `Company #${id}`,
            symbol: "",
            description: "Failed to load company details.",
            image: "",
            error: error?.message || "Failed to load",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      companies: companies.filter((company) => company.exists),
      count,
    });
  } catch (error: any) {
    console.error("Fetch companies error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch companies" },
      { status: 500 }
    );
  }
}
