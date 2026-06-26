"use client";

import { AutoConnect } from "thirdweb/react";
import { client, inAppSmartWallet } from "@/lib/thirdweb";

/**
 * Restores the persisted wallet session on ANY route — including deep links and
 * hard refreshes — not just the landing/login page.
 *
 * Without this, autoConnect only ran where a ConnectButton/ConnectEmbed was
 * mounted (the login screen), so refreshing a dashboard route never restored
 * the session and the user fell through to a blank/redirect state. Mounting
 * AutoConnect once at the app root makes the session survive refresh app-wide.
 */
export function AutoConnectProvider() {
  return (
    <AutoConnect
      client={client}
      wallets={[inAppSmartWallet]}
      timeout={15000}
    />
  );
}
