"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  MessageSquare,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  initSpacetimeDB,
  type ClientNotificationEvent,
} from "@/lib/spacetimedb";
import { REALTIME_NOTIFICATIONS_ENABLED } from "@/lib/realtime-config";

type NotificationCard = ClientNotificationEvent & {
  localId: string;
  count?: number;
};

const MAX_VISIBLE = 4;
const BATCH_MS = 600;
const MAX_SEEN_IDS = 600;

const eventMeta: Record<string, { icon: any; accent: string }> = {
  proposal_created: { icon: Briefcase, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  direct_offer_created: { icon: Briefcase, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  direct_offer_accepted: { icon: CheckCircle2, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  direct_offer_rejected: { icon: AlertTriangle, accent: "border-red-400/60 bg-red-500/10 text-red-700 dark:text-red-300" },
  direct_offer_cancelled: { icon: AlertTriangle, accent: "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  job_hired: { icon: CheckCircle2, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  job_funded: { icon: CheckCircle2, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  work_approved: { icon: CheckCircle2, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  job_cancel_requested: { icon: AlertTriangle, accent: "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  message_received: { icon: MessageSquare, accent: "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  work_submitted: { icon: Send, accent: "border-violet-400/60 bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  job_completed: { icon: CheckCircle2, accent: "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  job_cancelled: { icon: AlertTriangle, accent: "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  dispute_raised: { icon: ShieldAlert, accent: "border-red-400/60 bg-red-500/10 text-red-700 dark:text-red-300" },
  dispute_resolved: { icon: CheckCircle2, accent: "border-teal-400/60 bg-teal-500/10 text-teal-700 dark:text-teal-300" },
};

const notificationTime = (event: ClientNotificationEvent) => {
  if (typeof event.timestamp === "number") return event.timestamp;
  const parsed = new Date(event.timestamp).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const shortAddress = (address: string) => {
  if (!address || address.length < 10) return address || "Someone";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function ClientRealtimeNotifications() {
  return (
    <RealtimeNotifications
      updateEventName="worqs:client-realtime-update"
      workspaceLabel="client"
    />
  );
}

export function FreelancerRealtimeNotifications() {
  return (
    <RealtimeNotifications
      updateEventName="worqs:freelancer-realtime-update"
      workspaceLabel="freelancer"
    />
  );
}

function RealtimeNotifications({
  updateEventName,
  workspaceLabel,
}: {
  updateEventName: string;
  workspaceLabel: string;
}) {
  const account = useActiveAccount();
  const router = useRouter();
  const [cards, setCards] = useState<NotificationCard[]>([]);
  const seenIds = useRef<Set<number>>(new Set());
  const seenOrder = useRef<number[]>([]);
  const queue = useRef<ClientNotificationEvent[]>([]);
  const batchTimer = useRef<number | null>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!REALTIME_NOTIFICATIONS_ENABLED || !account?.address) return;

    let disposed = false;
    const client = initSpacetimeDB();
    const clientAddress = account.address.toLowerCase();

    const removeCardLater = (localId: string, delay = 6500) => {
      window.setTimeout(() => {
        setCards((prev) => prev.filter((card) => card.localId !== localId));
      }, delay);
    };

    const dispatchUpdate = (events: ClientNotificationEvent[]) => {
      window.dispatchEvent(new CustomEvent(updateEventName, {
        detail: {
          events,
          eventTypes: Array.from(new Set(events.map((event) => event.event_type))),
          entityTypes: Array.from(new Set(events.map((event) => event.entity_type))),
          entityIds: Array.from(new Set(events.map((event) => event.entity_id))),
        },
      }));
    };

    const flushQueue = () => {
      batchTimer.current = null;
      if (disposed || queue.current.length === 0) return;

      const events = queue.current.splice(0);
      dispatchUpdate(events);

      const nextCards: NotificationCard[] = [];
      const visibleEvents = events.slice(0, 3);
      visibleEvents.forEach((event) => {
        nextCards.push({
          ...event,
          localId: `${event.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        });
      });

      if (events.length > visibleEvents.length) {
        const overflow = events.length - visibleEvents.length;
        nextCards.push({
          ...events[events.length - 1],
          id: -Date.now(),
          localId: `summary-${Date.now()}`,
          event_type: "summary",
          title: `${overflow} more update${overflow === 1 ? "" : "s"}`,
          message: `Your ${workspaceLabel} workspace has new activity.`,
          count: overflow,
        });
      }

      setCards((prev) => [...nextCards, ...prev].slice(0, MAX_VISIBLE));
      nextCards.forEach((card) => removeCardLater(card.localId, card.event_type === "summary" ? 7200 : 6500));
    };

    const queueEvent = (event: ClientNotificationEvent) => {
      if (event.client_address?.toLowerCase() !== clientAddress) return;
      if (seenIds.current.has(event.id)) return;

      seenIds.current.add(event.id);
      seenOrder.current.push(event.id);
      if (seenOrder.current.length > MAX_SEEN_IDS) {
        const expiredId = seenOrder.current.shift();
        if (typeof expiredId === "number") seenIds.current.delete(expiredId);
      }

      const eventAge = notificationTime(event) - mountedAt.current;
      if (eventAge < -2000) return;

      queue.current.push(event);
      if (!batchTimer.current) {
        batchTimer.current = window.setTimeout(flushQueue, BATCH_MS);
      }
    };

    const offNotification = client.on("ClientNotificationEvent", "insert", queueEvent);
    const offConnect = client.onConnect(() => {
      client.subscribe(["SELECT * FROM ClientNotificationEvent"]);
    });

    client.connect();

    return () => {
      disposed = true;
      offNotification();
      offConnect();
      if (batchTimer.current) window.clearTimeout(batchTimer.current);
    };
  }, [account?.address, router, updateEventName, workspaceLabel]);

  if (!REALTIME_NOTIFICATIONS_ENABLED || cards.length === 0) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-[80] flex flex-col gap-2 pointer-events-none md:left-auto md:right-5 md:top-5 md:w-[24rem]">
      {cards.map((card) => {
        const meta = eventMeta[card.event_type] || { icon: Bell, accent: "border-primary/40 bg-primary/10 text-primary" };
        const Icon = meta.icon;
        return (
          <div
            key={card.localId}
            className="pointer-events-auto rounded-2xl border border-border bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex gap-3 p-3.5">
              <div className={`h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center ${meta.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => card.route && router.push(card.route)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-bold text-foreground truncate">{card.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {card.message || `Update from ${shortAddress(card.actor_address)}`}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCards((prev) => prev.filter((item) => item.localId !== card.localId))}
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center justify-center"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
