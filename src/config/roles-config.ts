import {
  Briefcase,
  User as UserIcon,
  Settings,
  Home as HomeIcon,
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
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/freelancer/Profile",
      match: "startsWith",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/freelancer/Settings", // you can add this route later
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
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/client/Profile", // add this route when ready
      match: "startsWith",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/client/Settings", // add this route when ready
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
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/founder/Settings",
      match: "startsWith",
    },
  ],

  investor: [
    {
      id: "home",
      label: "Home",
      icon: HomeIcon,
      path: "/investor",
      match: "exact",
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserIcon,
      path: "/investor/Profile",
      match: "startsWith",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/investor/Settings",
      match: "startsWith",
    },
  ],
};
