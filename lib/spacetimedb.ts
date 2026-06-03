export type Identity = string;

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

const SPACETIMEDB_API = "https://testnet.spacetimedb.com/api/v1/database";
const DB_NAME = "worqs-a8jpe"; // User's deployed database

export class SpacetimeDBClient {
  private listeners: Map<string, Function[]> = new Map();
  private isPolling = false;
  private pollInterval: any = null;
  
  // Local cache
  public rooms: ChatRoom[] = [];
  public messages: Message[] = [];
  public users: User[] = [];

  constructor() {}

  async call(reducer: string, args: any[]) {
    try {
      const res = await fetch(`${SPACETIMEDB_API}/call/${DB_NAME}/${reducer}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ args })
      });
      if (!res.ok) {
        console.error(`Reducer ${reducer} failed:`, await res.text());
      } else {
        // Immediately trigger a poll to fetch the new data
        this.poll();
      }
    } catch (err) {
      console.error(`Failed to call ${reducer}:`, err);
    }
  }

  async query(sql: string): Promise<any[]> {
    try {
      const res = await fetch(`${SPACETIMEDB_API}/sql/${DB_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql })
      });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error(`SQL query failed (${sql}):`, err);
      return [];
    }
  }

  onConnect(callback: (token: string, identity: any) => void) {
    // For REST, we don't have a strict WebSocket handshake.
    // We simulate connection established and start polling.
    setTimeout(() => {
      callback("rest-token", "rest-identity");
      this.startPolling();
    }, 100);
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
    // We handle data fetching in the poll loop.
    this.poll();
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // Fetch Rooms
      const roomsData = await this.query("SELECT * FROM ChatRoom");
      if (Array.isArray(roomsData)) {
        roomsData.forEach(r => {
          // Check if it's new
          if (!this.rooms.find(existing => existing.job_id === r.job_id)) {
            this.rooms.push(r);
            if (typeof window !== 'undefined') {
                const stored = JSON.parse(localStorage.getItem("spacetime_rooms") || "[]");
                if (!stored.find((s: any) => s.job_id === r.job_id)) {
                    stored.push(r);
                    localStorage.setItem("spacetime_rooms", JSON.stringify(stored));
                }
            }
            this.emit("ChatRoom", "insert", r);
          }
        });
      }

      // Fetch Messages
      const messagesData = await this.query("SELECT * FROM Message");
      if (Array.isArray(messagesData)) {
        messagesData.forEach(m => {
          // Check if it's new
          if (!this.messages.find(existing => existing.id === m.id)) {
            this.messages.push(m);
            if (typeof window !== 'undefined') {
                const stored = JSON.parse(localStorage.getItem("spacetime_messages") || "[]");
                if (!stored.find((s: any) => s.id === m.id)) {
                    stored.push(m);
                    localStorage.setItem("spacetime_messages", JSON.stringify(stored));
                }
            }
            this.emit("Message", "insert", m);
          }
        });
      }
    } catch (err) {
      console.error("Polling error:", err);
    } finally {
      this.isPolling = false;
    }
  }

  private startPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => this.poll(), 2000); // 2-second real-time feel
  }

  connect() {}
  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

let client: SpacetimeDBClient | null = null;

export const initSpacetimeDB = (
  url: string = "",
  dbName: string = ""
) => {
  if (client) return client;
  client = new SpacetimeDBClient();
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
  // Convert optional args to string to avoid undefined issues in JSON
  client.call("initiate_chat", [jobId, freelancerAddress]);
};

export const sendMessage = (jobId: string, content: string, senderAddress?: string) => {
  if (!client) return;
  client.call("send_message", [jobId, content]);
};

// --- HELPERS FOR CHAT DASHBOARD --- //

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
