import { SpacetimeDBClient, Identity } from "spacetimedb";

// Define our types manually since we can't run `spacetime generate` without the CLI
export type User = {
  identity: Identity;
  wallet_address: string;
  name: string;
  role: string;
};

export type ChatRoom = {
  job_id: string;
  client_address: string;
  freelancer_address: string;
};

export type Message = {
  id: number;
  job_id: string;
  sender_address: string;
  content: string;
  timestamp: number;
};

let client: SpacetimeDBClient | null = null;

export const initSpacetimeDB = (
  url: string = process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "ws://localhost:3000",
  dbName: string = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME || "spacetime-chat"
) => {
  if (client) return client;

  client = new SpacetimeDBClient(url, dbName);
  
  // Register tables we care about
  client.registerTable("User", {
    identity: "Identity",
    wallet_address: "String",
    name: "String",
    role: "String",
  });
  
  client.registerTable("ChatRoom", {
    job_id: "String",
    client_address: "String",
    freelancer_address: "String",
  });

  client.registerTable("Message", {
    id: "U64",
    job_id: "String",
    sender_address: "String",
    content: "String",
    timestamp: "U64",
  });

  return client;
};

export const getSpacetimeDBClient = () => {
  if (!client) {
    throw new Error("SpacetimeDB client not initialized");
  }
  return client;
};

// Helpers for calling reducers
export const registerUser = (walletAddress: string, name: string, role: string) => {
  if (!client) return;
  client.call("register_user", [walletAddress, name, role]);
};

export const initiateChat = (jobId: string, freelancerAddress: string) => {
  if (!client) return;
  client.call("initiate_chat", [jobId, freelancerAddress]);
};

export const sendMessage = (jobId: string, content: string) => {
  if (!client) return;
  client.call("send_message", [jobId, content]);
};
