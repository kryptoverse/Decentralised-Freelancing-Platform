"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Sparkles, X } from "lucide-react"

interface AIAssistantChatProps {
  isOpen: boolean
  onToggle: () => void
}

export function AIAssistantChat({ isOpen, onToggle }: AIAssistantChatProps) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your FYP AI Assistant. I can help you write better proposals, analyze startups, and automate your workflow. What can I help you with today?",
      sender: "ai",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const suggestions = [
    "Write a job proposal",
    "Analyze startup metrics",
    "Generate pitch deck outline",
    "Review contract terms",
  ]

  const handleSendMessage = (text: string = input) => {
    if (!text.trim()) return
    const userMessage = { id: messages.length + 1, text, sender: "user", timestamp: new Date() }
    setMessages([...messages, userMessage])
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const aiMessage = {
        id: messages.length + 2,
        text: "I'm processing your request. In a production environment, this would connect to an AI model for intelligent responses.",
        sender: "ai",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
      setIsTyping(false)
    }, 1500)
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
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-3 rounded-2xl ${message.sender === "user"
                          ? "bg-gradient-primary dark:text-white text-gray-900 rounded-br-none"
                          : "glass-effect text-foreground rounded-bl-none"
                        }`}
                    >
                      <p className="text-sm break-words">{message.text}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                  <div className="glass-effect px-4 py-3 rounded-2xl rounded-bl-none">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-primary"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="flex flex-wrap gap-2"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(suggestion)}
                      className="px-3 py-1 rounded-full glass-effect text-xs text-foreground hover:bg-surface-secondary transition-all duration-300 ease-out"
                    >
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-border flex-wrap md:flex-nowrap">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask me..."
                className="flex-1 px-3 py-2 rounded-full glass-effect bg-surface border border-border text-foreground placeholder-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 ease-out text-sm min-w-[120px]"
              />
              <button
                onClick={() => handleSendMessage()}
                className="px-4 py-2 rounded-full bg-gradient-primary text-white font-medium hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 ease-out disabled:opacity-50"
                disabled={!input.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
