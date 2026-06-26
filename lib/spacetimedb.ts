import { REALTIME_NOTIFICATIONS_ENABLED } from "@/lib/realtime-config";
import { DEPLOYED_CONTRACTS } from "@/constants/deployedContracts";

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

export type ChatMember = {
  member_key: string;
  job_id: string;
  wallet_address: string;
  member_role: string;
};

export type ClientNotificationEvent = {
  id: number;
  client_address: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_address: string;
  title: string;
  message: string;
  route: string;
  timestamp: number | string;
};

export type ClientNotificationPayload = Omit<ClientNotificationEvent, "id" | "timestamp">;

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

const sortMessages = (messages: Message[]) => {
  return [...messages].sort((a, b) => messageTime(a) - messageTime(b));
};

// Deployment salt: makes chat-room ids unique per chain + contract deployment.
// Without it, redeploying JobBoard resets on-chain job ids (0,1,2…) so a
// brand-new job's room (`project-0`) would resurface messages from a PREVIOUS
// deployment's job 0 (messages live in SpacetimeDB, not on-chain). Including
// the chain id + JobBoard address guarantees a fresh, isolated room set per
// deployment. Contains no "-" so the trailing job id stays parseable.
const CHAT_NS = `${DEPLOYED_CONTRACTS.chainId}x${(DEPLOYED_CONTRACTS.addresses.JobBoard || "").slice(2, 10).toLowerCase()}`;

export const getProjectChatId = (jobId: string | number | bigint) => `project-${CHAT_NS}-${String(jobId)}`;

export const isProjectChatId = (jobId: string) => jobId.startsWith("project-");

// The numeric job id is the trailing segment (`project-<ns>-<jobId>`).
export const getJobIdFromProjectChatId = (jobId: string) => (
  isProjectChatId(jobId) ? (jobId.split("-").pop() ?? jobId) : jobId
);

export const getCompanyChatId = (companyId: string | number | bigint) => `company-${String(companyId)}`;

export const isCompanyChatId = (jobId: string) => jobId.startsWith("company-");

export const getCompanyIdFromChatId = (jobId: string) => (
  isCompanyChatId(jobId) ? jobId.slice("company-".length) : jobId
);

export const getCompanyChatParticipantAddress = (companyId: string | number | bigint) => (
  `company-group-${String(companyId)}`
);

// Direct (job-independent) DM room between two wallets. Pair-scoped BY DESIGN:
// the same room is reused for every conversation between these two people,
// across all jobs and over time — it is NOT a per-job chat. Addresses are
// lowercased and ordered so both parties resolve to the SAME room id no matter
// who opens it or how each address happens to be cased/checksummed (otherwise
// the pair could end up in two mismatched rooms).
export const getDirectChatId = (addressA: string, addressB: string) => {
  const [lo, hi] = [addressA.toLowerCase(), addressB.toLowerCase()].sort();
  return `direct-${CHAT_NS}-${lo}-${hi}`;
};

const readStorageArray = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];

  try {
    const value = localStorage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    localStorage.removeItem(key);
    return [];
  }
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
  public chatMembers: ChatMember[] = [];
  public clientNotifications: ClientNotificationEvent[] = [];

  constructor() {}

  // NOTE: SpacetimeDB's HTTP `/call/:reducer` endpoint expects the body to be a
  // JSON ARRAY of positional arguments in the order the reducer declares them.
  // Passing a keyed object makes the module fail to deserialize its args and
  // return "the instance encountered a fatal error" (HTTP 530). Always pass an
  // array here, ordered to match the Rust reducer signature.
  async call(reducer: string, args: any[]) {
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

    return () => {
      this.connectCallbacks = this.connectCallbacks.filter(cb => cb !== callback);
    };
  }

  on(table: string, event: string, callback: (row: any) => void) {
    const key = `${table}:${event}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key)!.push(callback);

    return () => {
      const callbacks = this.listeners.get(key);
      if (!callbacks) return;

      const nextCallbacks = callbacks.filter(cb => cb !== callback);
      if (nextCallbacks.length === 0) {
        this.listeners.delete(key);
      } else {
        this.listeners.set(key, nextCallbacks);
      }
    };
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

      // Fetch company chat members
      const membersData = await this.query("SELECT * FROM ChatMember");
      if (Array.isArray(membersData)) {
        membersData.forEach(member => {
          if (this.upsertChatMember(member)) {
            this.emit("ChatMember", "insert", member);
          }
        });
      }

      if (REALTIME_NOTIFICATIONS_ENABLED) {
        const notificationData = await this.query("SELECT * FROM ClientNotificationEvent");
        if (Array.isArray(notificationData)) {
          notificationData.forEach(n => {
            if (this.upsertClientNotification(n)) {
              this.emit("ClientNotificationEvent", "insert", n);
            }
          });
        }
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
      const stored = readStorageArray<ChatRoom>("spacetime_rooms");
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

  removeRoom(jobId: string) {
    this.rooms = this.rooms.filter(room => room.job_id !== jobId);

    if (typeof window !== 'undefined') {
      const stored = readStorageArray<ChatRoom>("spacetime_rooms").filter(room => room.job_id !== jobId);
      localStorage.setItem("spacetime_rooms", JSON.stringify(stored));
      window.dispatchEvent(new CustomEvent("spacetime_update"));
    }
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
    this.messages = sortMessages(this.messages);

    if (typeof window !== 'undefined') {
      const stored = readStorageArray<Message>("spacetime_messages");
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
      localStorage.setItem("spacetime_messages", JSON.stringify(sortMessages(stored)));
    }

    return isNew;
  }

  removeMessage(id: number) {
    this.messages = this.messages.filter(message => message.id !== id);

    if (typeof window !== 'undefined') {
      const stored = readStorageArray<Message>("spacetime_messages").filter(message => message.id !== id);
      localStorage.setItem("spacetime_messages", JSON.stringify(stored));
      window.dispatchEvent(new CustomEvent("spacetime_update"));
    }
  }

  upsertChatMember(member: ChatMember) {
    const existingIndex = this.chatMembers.findIndex(existing => existing.member_key === member.member_key);
    const isNew = existingIndex === -1;
    if (isNew) {
      this.chatMembers.push(member);
    } else {
      this.chatMembers[existingIndex] = member;
    }

    if (typeof window !== 'undefined') {
      const stored = readStorageArray<ChatMember>("spacetime_chat_members");
      const storedIndex = stored.findIndex((s: ChatMember) => s.member_key === member.member_key);
      if (storedIndex === -1) {
        stored.push(member);
      } else {
        stored[storedIndex] = member;
      }
      localStorage.setItem("spacetime_chat_members", JSON.stringify(stored));
    }

    return isNew;
  }

  upsertClientNotification(notification: ClientNotificationEvent) {
    const existingIndex = this.clientNotifications.findIndex(existing => existing.id === notification.id);
    const isNew = existingIndex === -1;
    if (isNew) {
      this.clientNotifications.push(notification);
    } else {
      this.clientNotifications[existingIndex] = notification;
    }

    if (this.clientNotifications.length > 250) {
      this.clientNotifications = [...this.clientNotifications]
        .sort((a, b) => b.id - a.id)
        .slice(0, 250);
    }

    return isNew;
  }
}

let client: SpacetimeDBClient | null = null;

// Bump this whenever the cached chat data could be stale/corrupt and should be
// rebuilt from the server. v2: reducer args were previously sent as objects
// (never persisted server-side), leaving orphaned optimistic rows in cache.
// v3: chat-room ids are now namespaced per deployment + direct ids normalized,
// so rooms/messages cached under the old id scheme must be dropped.
const CACHE_VERSION = "3";
const CACHE_VERSION_KEY = "spacetime_cache_version";
const CACHE_KEYS = ["spacetime_messages", "spacetime_rooms", "spacetime_chat_members"];

const purgeStaleCacheOnce = () => {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(CACHE_VERSION_KEY) === CACHE_VERSION) return;
    CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
  } catch (err) {
    console.warn("Failed to purge stale SpacetimeDB cache:", err);
  }
};

export const initSpacetimeDB = (
  url: string = "",
  dbName: string = ""
) => {
  if (client) return client;
  purgeStaleCacheOnce();
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
  // register_user(wallet_address, name, role)
  return client.call("register_user", [walletAddress, name, role]);
};

export const initiateChat = (jobId: string, freelancerAddress: string, clientAddress?: string, initiatorRole = "client") => {
  if (!client) return Promise.resolve(false);
  const room = {
    job_id: jobId,
    client_address: clientAddress || "",
    freelancer_address: freelancerAddress,
  };
  client.upsertRoom(room);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent("spacetime_update"));
  }

  // initiate_chat(job_id, freelancer_address, client_address, initiator_role)
  return client.call("initiate_chat", [jobId, freelancerAddress, clientAddress || "", initiatorRole]).then((ok) => {
    if (!ok) {
      client?.removeRoom(jobId);
      console.error("Failed to initiate chat room", { jobId, freelancerAddress, clientAddress });
    }
    return ok;
  });
};

export const initiateCompanyChat = (companyId: string | number | bigint, founderAddress: string) => {
  return initiateChat(
    getCompanyChatId(companyId),
    getCompanyChatParticipantAddress(companyId),
    founderAddress,
    "founder"
  );
};

export const ensureChatMember = (jobId: string, walletAddress: string, memberRole: string) => {
  if (!client) return Promise.resolve(false);
  // ensure_chat_member(job_id, wallet_address, member_role)
  return client.call("ensure_chat_member", [jobId, walletAddress, memberRole]);
};

export const setupCompanyGroupChat = async ({
  companyId,
  founderAddress,
  walletAddress,
  memberRole,
  displayName,
}: {
  companyId: string | number | bigint;
  founderAddress: string;
  walletAddress: string;
  memberRole: "founder" | "investor";
  displayName?: string;
}) => {
  const chatClient = initSpacetimeDB();
  chatClient.connect();

  await new Promise<void>((resolve) => {
    const off = chatClient.onConnect(() => {
      off();
      resolve();
    });
    setTimeout(resolve, 300);
  });

  registerUser(walletAddress, displayName || `User ${walletAddress.slice(0, 6)}`, memberRole);

  const chatId = getCompanyChatId(companyId);
  await initiateCompanyChat(companyId, founderAddress);
  await refreshSpacetimeDB();
  return ensureChatMember(chatId, walletAddress, memberRole);
};

export const sendMessage = (jobId: string, content: string, senderAddress?: string) => {
  if (!client) return Promise.resolve(false);
  let optimisticId: number | null = null;

  if (senderAddress) {
    optimisticId = -Date.now();
    const optimisticMessage: Message = {
      id: optimisticId,
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

  // send_message(job_id, content, sender_address)
  return client.call("send_message", [jobId, content, senderAddress || ""]).then((ok) => {
    if (!ok) {
      if (optimisticId !== null) client?.removeMessage(optimisticId);
      console.error("Failed to send chat message", { jobId, senderAddress });
    } else if (senderAddress) {
      const room = client?.rooms.find(r => r.job_id === jobId) || getChatRoomById(jobId);
      if (room && room.client_address && senderAddress.toLowerCase() !== room.client_address.toLowerCase()) {
        const projectJobId = isProjectChatId(jobId) ? getJobIdFromProjectChatId(jobId) : null;
        void safeTriggerClientNotification({
          client_address: room.client_address,
          event_type: "message_received",
          entity_type: "chat",
          entity_id: jobId,
          actor_address: senderAddress,
          title: "New message",
          message: "A freelancer sent you a message.",
          route: projectJobId ? `/client/jobs/${projectJobId}` : `/client/chat?chatId=${encodeURIComponent(jobId)}`,
        });
      }
    }
    return ok;
  });
};

export const triggerClientNotification = (payload: ClientNotificationPayload) => {
  if (!REALTIME_NOTIFICATIONS_ENABLED) return Promise.resolve(false);
  const spacetime = initSpacetimeDB();
  // trigger_client_notification(client_address, event_type, entity_type, entity_id,
  //                             actor_address, title, message, route)
  return spacetime.call("trigger_client_notification", [
    payload.client_address,
    payload.event_type,
    payload.entity_type,
    payload.entity_id,
    payload.actor_address,
    payload.title,
    payload.message,
    payload.route,
  ]);
};

export const safeTriggerClientNotification = async (payload: ClientNotificationPayload) => {
  if (!REALTIME_NOTIFICATIONS_ENABLED) return false;
  try {
    return await triggerClientNotification(payload);
  } catch (err) {
    console.warn("Realtime client notification skipped:", err);
    return false;
  }
};

// --- HELPERS FOR CHAT DASHBOARD --- //

export const getAllChatsForUser = (
  walletAddress: string,
  options: { includeProjectChats?: boolean; includeCompanyChatIds?: string[] } = {}
): ChatRoom[] => {
  if (typeof window === 'undefined') return [];
  const rooms = readStorageArray<ChatRoom>("spacetime_rooms");
  const companyChatIds = new Set(options.includeCompanyChatIds || []);
  return rooms.filter(
    r => r.client_address.toLowerCase() === walletAddress.toLowerCase() ||
         r.freelancer_address.toLowerCase() === walletAddress.toLowerCase() ||
         companyChatIds.has(r.job_id)
  ).filter(room => options.includeProjectChats || !isProjectChatId(room.job_id))
    .filter(room => companyChatIds.has(room.job_id) || !isCompanyChatId(room.job_id));
};

export const getChatRoomById = (jobId: string): ChatRoom | undefined => {
  if (typeof window === 'undefined') return undefined;
  const rooms = readStorageArray<ChatRoom>("spacetime_rooms");
  return rooms.find(room => room.job_id === jobId);
};

export const getMessagesForChat = (jobId: string): Message[] => {
  if (typeof window === 'undefined') return [];
  const messages = readStorageArray<Message>("spacetime_messages");
  return sortMessages(messages.filter(m => m.job_id === jobId));
};

export const getChatMembersForRoom = (jobId: string): ChatMember[] => {
  if (typeof window === 'undefined') return [];
  const members = readStorageArray<ChatMember>("spacetime_chat_members");
  return members.filter(member => member.job_id === jobId);
};

export const isWalletInCompanyChat = (jobId: string, walletAddress: string): boolean => {
  const normalized = walletAddress.toLowerCase();
  return getChatMembersForRoom(jobId).some(
    member => member.wallet_address.toLowerCase() === normalized
  );
};

export const getCachedMessages = (): Message[] => {
  return sortMessages(readStorageArray<Message>("spacetime_messages"));
};

export const refreshSpacetimeDB = async () => {
  if (!client) return;
  await client.poll();
};
