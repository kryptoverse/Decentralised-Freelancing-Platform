export type Identity = string;

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

export class SpacetimeDBClient {
  private listeners: Map<string, Function[]> = new Map();

  constructor(public url: string, public dbName: string) {}
  
  registerTable(name: string, schema: any) {}
  
  call(reducer: string, args: any[]) {
    if (reducer === "initiate_chat") {
      const [jobId, freelancerAddress, clientAddress] = args;
      const rooms: ChatRoom[] = JSON.parse(localStorage.getItem("spacetime_rooms") || "[]");
      if (!rooms.find(r => r.job_id === jobId)) {
        const newRoom = { job_id: jobId, freelancer_address: freelancerAddress, client_address: clientAddress || "0xClient" };
        rooms.push(newRoom);
        localStorage.setItem("spacetime_rooms", JSON.stringify(rooms));
        this.emit("ChatRoom", "insert", newRoom);
      }
    } else if (reducer === "send_message") {
      const [jobId, content, senderAddress] = args;
      const messages: Message[] = JSON.parse(localStorage.getItem("spacetime_messages") || "[]");
      const newMsg = {
        id: Date.now(),
        job_id: jobId,
        sender_address: senderAddress || "0xUnknown",
        content,
        timestamp: Date.now()
      };
      messages.push(newMsg);
      localStorage.setItem("spacetime_messages", JSON.stringify(messages));
      this.emit("Message", "insert", newMsg);
    }
  }
  
  onConnect(callback: (token: string, identity: any) => void) {
    setTimeout(() => callback("mock-token", "mock-identity"), 500);
  }
  
  on(table: string, event: string, callback: (row: any) => void) {
    const key = `${table}:${event}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key)!.push(callback);
  }

  private emit(table: string, event: string, row: any) {
    const key = `${table}:${event}`;
    const cbList = this.listeners.get(key);
    if (cbList) cbList.forEach(cb => cb(row));

    // Dispatch global event for dashboard real-time syncing
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("spacetime_update"));
    }
  }
  
  subscribe(queries: string[]) {
    // Simulate initial data load after subscription
    setTimeout(() => {
      const rooms: ChatRoom[] = JSON.parse(localStorage.getItem("spacetime_rooms") || "[]");
      const messages: Message[] = JSON.parse(localStorage.getItem("spacetime_messages") || "[]");
      rooms.forEach(r => this.emit("ChatRoom", "insert", r));
      messages.forEach(m => this.emit("Message", "insert", m));
    }, 200);
  }
  
  connect() {}
  disconnect() {}
}

let client: SpacetimeDBClient | null = null;

export const initSpacetimeDB = (
  url: string = process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "ws://localhost:3000",
  dbName: string = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME || "spacetime-chat"
) => {
  if (client) return client;
  client = new SpacetimeDBClient(url, dbName);
  return client;
};

export const getSpacetimeDBClient = () => {
  if (!client) throw new Error("SpacetimeDB client not initialized");
  return client;
};

// Helpers for calling reducers
export const registerUser = (walletAddress: string, name: string, role: string) => {
  if (!client) return;
  client.call("register_user", [walletAddress, name, role]);
};

export const initiateChat = (jobId: string, freelancerAddress: string, clientAddress?: string) => {
  if (!client) return;
  client.call("initiate_chat", [jobId, freelancerAddress, clientAddress]);
};

export const sendMessage = (jobId: string, content: string, senderAddress?: string) => {
  if (!client) return;
  client.call("send_message", [jobId, content, senderAddress]);
};

// --- NEW HELPERS FOR CHAT DASHBOARD --- //

export const getAllChatsForUser = (walletAddress: string): ChatRoom[] => {
  if (typeof window === 'undefined') return [];
  const rooms: ChatRoom[] = JSON.parse(localStorage.getItem("spacetime_rooms") || "[]");
  return rooms.filter(
    r => r.client_address.toLowerCase() === walletAddress.toLowerCase() || 
         r.freelancer_address.toLowerCase() === walletAddress.toLowerCase()
  );
};

export const getMessagesForChat = (jobId: string): Message[] => {
  if (typeof window === 'undefined') return [];
  const messages: Message[] = JSON.parse(localStorage.getItem("spacetime_messages") || "[]");
  return messages.filter(m => m.job_id === jobId);
};
