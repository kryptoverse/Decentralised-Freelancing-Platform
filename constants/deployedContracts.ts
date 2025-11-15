import deployed from "./deployedContracts.json";

export const DEPLOYED_CONTRACTS = deployed as {
  network: string;
  chainId: number;
  addresses: Record<
    | "MockUSDT"
    | "FreelancerFactory"
    | "ClientFactory"
    | "EscrowFactory"
    | "JobBoard",
    string
  >;
  roles: {
    platformWallet: string;
    resolver: string;
  };
};
