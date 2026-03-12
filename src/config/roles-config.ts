import {
  Briefcase,
  User as UserIcon,
  Settings,
  Home as HomeIcon,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const ROLE_ROUTES = {
  freelancer: "freelancer",
  client: "client",
  founder: "founder",
  investor: "investor",
} as const;

export const ROLE_LABELS = {
  freelancer: "Freelancer",
  client: "Client",
  founder: "Founder",
  investor: "Investor",
} as const;

/**
 * Each item:
 *  - path: actual Next.js route
 *  - match:
 *      "exact"       -> only active on that exact path
 *      "startsWith"  -> active on that path or deeper nested
 */
export const ROLE_TABS: Record<
  keyof typeof ROLE_ROUTES,
  Array<{
    id: string;
    label: string;
    icon: any;
    path: string;
    match: "exact" | "startsWith";
  }>
> = {
  freelancer: [
    {
      id: "home",
      label: "Home",
      icon: HomeIcon,
      path: "/freelancer",
      match: "exact",
    },
    {
      id: "find-work",
      label: "Find Work",
      icon: Briefcase,
      path: "/freelancer/FindWork",
      match: "startsWith",
    },
    {
      id: "proposals",
      label: "Proposals",
      icon: Briefcase, // Or another icon like FileText if imported
      path: "/freelancer/proposals",
      match: "startsWith",
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/freelancer/Profile",
      match: "startsWith",
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: Wallet,
      path: "/freelancer/wallet", // you can add this route later
      match: "startsWith",
    },
  ],

  client: [
    {
      id: "home",
      label: "Home",
      icon: HomeIcon,
      path: "/client",
      match: "exact",
    },
    {
      id: "find-freelancer",
      label: "Find Freelancer",
      icon: Briefcase,
      path: "/client/find-freelancer",
      match: "startsWith",
    },
    {
      id: "offers",
      label: "My Offers",
      icon: Briefcase, // Or specific icon
      path: "/client/offers",
      match: "startsWith",
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/client/profile", // add this route when ready
      match: "startsWith",
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: Wallet,
      path: "/client/wallet", // add this route when ready
      match: "startsWith",
    },
  ],

  founder: [
    {
      id: "home",
      label: "Home",
      icon: HomeIcon,
      path: "/founder",
      match: "exact",
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/founder/Profile",
      match: "startsWith",
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: Wallet,
      path: "/founder/wallet",
      match: "startsWith",
    },
  ],

  investor: [
    {
      id: "portfolio",
      label: "My Investments",
      icon: TrendingUp,
      path: "/investor",
      match: "exact",
    },
    {
      id: "explore",
      label: "Explore",
      icon: HomeIcon,
      path: "/investor/explore",
      match: "startsWith",
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/investor/profile",
      match: "startsWith",
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: Wallet,
      path: "/investor/wallet",
      match: "startsWith",
    },
  ],
};
