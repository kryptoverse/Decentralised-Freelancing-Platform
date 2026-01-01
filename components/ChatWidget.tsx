"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"

type Msg = { id: string; role: "user" | "assistant"; content: string }

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    { id: "welcome", role: "assistant", content: "Hi! This chat UI is a placeholder. AI logic coming soon." },
  ])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    if (!input.trim() || pending) return

    const user: Msg = { id: crypto.randomUUID(), role: "user", content: input.trim() }
    setMessages((m) => [...m, user])
    setInput("")
    setPending(true)

    // Frontend-only placeholder response
    setTimeout(() => {
      const reply: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Thanks! This is a UI-only chat. Wire up your AI logic by editing sendMessage() in components/ChatWidget.tsx.",
      }
      setMessages((m) => [...m, reply])
      setPending(false)
    }, 500)
  }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={() => setOpen(true)} className="rounded-full h-12 w-12 p-0" aria-label="Open chat">
          <span className="sr-only">Open chat</span>
          {/* Simple chat glyph */}
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 5h16v9a3 3 0 0 1-3 3H9l-5 4V8a3 3 0 0 1 3-3Z" fill="currentColor" opacity="0.15" />
            <path
              d="M4 5h16v9a3 3 0 0 1-3 3H9l-5 4V8a3 3 0 0 1 3-3Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </Button>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chat Assistant (UI Only)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <ScrollArea className="h-72 rounded-md border bg-card p-3">
              <div className="grid gap-3">
                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                    <div
                      className={
                        "inline-block rounded-md px-3 py-2 " +
                        (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </ScrollArea>
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message (no AI backend wired yet)..."
              />
              <Button type="submit" disabled={pending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
