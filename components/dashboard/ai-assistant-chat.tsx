"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Sparkles, X, Loader2 } from "lucide-react"
import { useChatContext } from "@/components/chat/ChatContext"

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

interface AIAssistantChatProps {
  isOpen: boolean
  onToggle: () => void
}

export function AIAssistantChat({ isOpen, onToggle }: AIAssistantChatProps) {
  const { chatContext } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: "Hello! I'm your WORQS AI Assistant. I have context about your current page. What can I help you with today?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const append = async (message: { role: "user" | "assistant" | "system", content: string }) => {
    const newMessage: Message = { id: Date.now().toString(), ...message };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, systemContext: chatContext }),
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      const assistantMessage: Message = { id: Date.now().toString() + "-ai", role: "assistant", content: "" };
      setMessages([...newMessages, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMessage.content += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMessage };
          return updated;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    append({ role: "user", content: userMessage });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const suggestions = [
    "What is my total invested amount?",
    "Summarize my dashboard stats",
    "What does WORQS do?",
  ]

  const handleSuggestion = (text: string) => {
    append({ role: "user", content: text });
  }

  return (
    <>
      <motion.button
        onClick={onToggle}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-gradient-primary text-white shadow-lg hover:shadow-xl flex items-center justify-center z-40 transition-all duration-300 ease-out border-2 border-primary/50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 md:right-6 md:bottom-24 w-full max-w-[95vw] md:w-96 h-[500px] rounded-2xl glass-effect-dark border border-border shadow-2xl flex flex-col z-40"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                <h3 className="font-semibold text-foreground">AI Assistant</h3>
              </div>
              <button
                onClick={onToggle}
                className="p-1 rounded-lg hover:bg-surface-secondary transition-all duration-300 ease-out"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-4">
              <AnimatePresence>
                {messages.map((message: Message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl ${message.role === "user"
                          ? "bg-gradient-primary dark:text-white text-gray-900 rounded-br-none"
                          : "glass-effect text-foreground rounded-bl-none border border-border/50"
                        }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                  <div className="glass-effect px-4 py-3 rounded-2xl rounded-bl-none border border-border/50">
                    <div className="flex gap-1 items-center">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground ml-2">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="flex flex-col gap-2 mt-4"
                >
                  <p className="text-xs text-muted-foreground/70 mb-1 px-1">Suggested questions based on your context:</p>
                  <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestion(suggestion)}
                      className="px-3 py-1.5 rounded-full glass-effect border border-primary/20 text-xs text-foreground hover:bg-surface-secondary hover:border-primary/50 transition-all duration-300 ease-out text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-border flex-wrap md:flex-nowrap bg-background/50 rounded-b-2xl">
              <input
                type="text"
                value={input || ""}
                onChange={handleInputChange}
                placeholder="Ask your AI assistant..."
                className="flex-1 px-4 py-2.5 rounded-full glass-effect bg-surface border border-border text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 ease-out text-sm min-w-[120px]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-full bg-gradient-primary text-white font-medium hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 ease-out disabled:opacity-50 flex items-center justify-center shrink-0"
                disabled={!input?.trim() || isLoading}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
