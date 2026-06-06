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
  timestamp: number | string;
};

const DEFAULT_SPACETIMEDB_API = "https://maincloud.spacetimedb.com/v1/database";

const normalizeSpacetimeApi = (uri?: string) => {
  const value = uri?.trim();
  if (!value || value.startsWith("/") || !/^https?:\/\//i.test(value)) {
    return DEFAULT_SPACETIMEDB_API;
  }

  const withoutTrailingSlash = value.replace(/\/+$/, "");
  if (withoutTrailingSlash.endsWith("/v1/database")) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/v1/database`;
};

const SPACETIMEDB_API = normalizeSpacetimeApi(
  process.env.NEXT_PUBLIC_SPACETIMEDB_API_URI ||
  process.env.NEXT_PUBLIC_SPACETIMEDB_REST_URI ||
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI
);
const DB_NAME = (
  process.env.NEXT_PUBLIC_SPACETIMEDB_NAME ||
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ||
  "worqs-a8jpe"
).trim(); // User's deployed database

const messageTime = (message: Message) => {
  return typeof message.timestamp === "number"
    ? message.timestamp
    : new Date(message.timestamp).getTime();
};

const normalizeSqlResponse = (data: any): any[] => {
  if (!Array.isArray(data)) return [];
  if (data.length === 0) return [];

  if (!data[0]?.schema?.elements || !Array.isArray(data[0]?.rows)) {
    return data;
  }

  return data.flatMap((result: any) => {
    const columns = result.schema.elements.map((element: any) => element.name?.some).filter(Boolean);
    return result.rows.map((row: any[]) => {
      return columns.reduce((record: Record<string, any>, column: string, index: number) => {
        record[column] = row[index];
        return record;
      }, {});
    });
  });
};

export class SpacetimeDBClient {
  private listeners: Map<string, Function[]> = new Map();
  private isPolling = false;
  private pollInterval: any = null;
  private connectCallbacks: Array<(token: string, identity: any) => void> = [];
  private connected = false;
  
  // Local cache
  public rooms: ChatRoom[] = [];
  public messages: Message[] = [];
  public users: User[] = [];

  constructor() {}

  async call(reducer: string, args: any[] | Record<string, any>) {
    try {
      const res = await fetch(`${SPACETIMEDB_API}/${DB_NAME}/call/${reducer}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args)
      });
      if (!res.ok) {
        console.error(`Reducer ${reducer} failed:`, await res.text());
        return false;
      } else {
        // Immediately trigger a poll to fetch the new data
        await this.poll();
        return true;
      }
    } catch (err) {
      console.error(`Failed to call ${reducer}:`, err);
      return false;
    }
  }

  async query(sql: string): Promise<any[]> {
    try {
      const res = await fetch(`${SPACETIMEDB_API}/${DB_NAME}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: sql
      });
      if (res.ok) {
        return normalizeSqlResponse(await res.json());
      }
      return [];
    } catch (err) {
      console.error(`SQL query failed (${sql}):`, err);
      return [];
    }
  }

  onConnect(callback: (token: string, identity: any) => void) {
    this.connectCallbacks.push(callback);

    if (this.connected) {
      callback("rest-token", "rest-identity");
    }
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

  async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // Fetch Rooms
      const roomsData = await this.query("SELECT * FROM ChatRoom");
      if (Array.isArray(roomsData)) {
        roomsData.forEach(r => {
          if (this.upsertRoom(r)) {
            this.emit("ChatRoom", "insert", r);
          }
        });
      }

      // Fetch Messages
      const messagesData = await this.query("SELECT * FROM Message");
      if (Array.isArray(messagesData)) {
        messagesData.forEach(m => {
          if (this.upsertMessage(m)) {
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

  connect() {
    if (this.connected) return;
    this.connected = true;
    setTimeout(() => {
      this.connectCallbacks.forEach(callback => callback("rest-token", "rest-identity"));
      this.startPolling();
      this.poll();
    }, 100);
  }
  disconnect() {
    // Keep the shared polling client alive while the app is mounted.
  }

  upsertRoom(room: ChatRoom) {
    const existingIndex = this.rooms.findIndex(existing => existing.job_id === room.job_id);
    const isNew = existingIndex === -1;
    if (isNew) {
      this.rooms.push(room);
    } else {
      this.rooms[existingIndex] = room;
    }

    if (typeof window !== 'undefined') {
      const stored: ChatRoom[] = JSON.parse(localStorage.getItem("spacetime_rooms") || "[]");
      const storedIndex = stored.findIndex((s: ChatRoom) => s.job_id === room.job_id);
      if (storedIndex === -1) {
        stored.push(room);
      } else {
        stored[storedIndex] = room;
      }
      localStorage.setItem("spacetime_rooms", JSON.stringify(stored));
    }

    return isNew;
  }

  upsertMessage(message: Message) {
    let existingIndex = this.messages.findIndex(existing => existing.id === message.id);
    if (existingIndex === -1 && message.id > 0) {
      existingIndex = this.messages.findIndex(existing =>
        existing.id < 0 &&
        existing.job_id === message.job_id &&
        existing.sender_address.toLowerCase() === message.sender_address.toLowerCase() &&
        existing.content === message.content
      );
    }
    const isNew = existingIndex === -1;
    if (isNew) {
      this.messages.push(message);
    } else {
      this.messages[existingIndex] = message;
    }
    this.messages.sort((a, b) => messageTime(a) - messageTime(b));

    if (typeof window !== 'undefined') {
      const stored: Message[] = JSON.parse(localStorage.getItem("spacetime_messages") || "[]");
      let storedIndex = stored.findIndex((s: Message) => s.id === message.id);
      if (storedIndex === -1 && message.id > 0) {
        storedIndex = stored.findIndex((s: Message) =>
          s.id < 0 &&
          s.job_id === message.job_id &&
          s.sender_address.toLowerCase() === message.sender_address.toLowerCase() &&
          s.content === message.content
        );
      }
      if (storedIndex === -1) {
        stored.push(message);
      } else {
        stored[storedIndex] = message;
      }
      stored.sort((a, b) => messageTime(a) - messageTime(b));
      localStorage.setItem("spacetime_messages", JSON.stringify(stored));
    }

    return isNew;
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
  client.call("register_user", {
    wallet_address: walletAddress,
    name,
    role,
  });
};

export const initiateChat = (jobId: string, freelancerAddress: string, clientAddress?: string, initiatorRole = "client") => {
  if (!client) return;
  const room = {
    job_id: jobId,
    client_address: clientAddress || "",
    freelancer_address: freelancerAddress,
  };
  client.upsertRoom(room);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent("spacetime_update"));
  }

  client.call("initiate_chat", {
    job_id: jobId,
    freelancer_address: freelancerAddress,
    client_address: clientAddress || "",
    initiator_role: initiatorRole,
  }).then((ok) => {
    if (!ok) console.error("Failed to initiate chat room", { jobId, freelancerAddress, clientAddress });
  });
};

export const sendMessage = (jobId: string, content: string, senderAddress?: string) => {
  if (!client) return;
  if (senderAddress) {
    const optimisticMessage: Message = {
      id: -Date.now(),
      job_id: jobId,
      sender_address: senderAddress,
      content,
      timestamp: Date.now(),
    };
    client.upsertMessage(optimisticMessage);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent("spacetime_update"));
    }
  }

  client.call("send_message", {
    job_id: jobId,
    content,
    sender_address: senderAddress || "",
  }).then((ok) => {
    if (!ok) console.error("Failed to send chat message", { jobId, senderAddress });
  });
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

export const refreshSpacetimeDB = async () => {
  if (!client) return;
  await client.poll();
};
