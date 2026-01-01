"use client"

import { useState } from "react"
import { Send } from "lucide-react"

const AIAssistantTab = () => {
  const [input, setInput] = useState("")

  const handleSendMessage = () => {
    // Logic to handle sending message
  }

  return (
    <div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full p-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        onClick={() => handleSendMessage()}
        className="px-6 py-3 rounded-full bg-gradient-primary text-white font-medium hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 ease-out disabled:opacity-50"
        disabled={!input.trim()}
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  )
}

export default AIAssistantTab
