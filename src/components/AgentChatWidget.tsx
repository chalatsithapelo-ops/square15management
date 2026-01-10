import { useState, useEffect } from "react";
import { Bot, X, ChevronDown, ChevronUp } from "lucide-react";
import AgentChat from "~/components/AgentChat";
import { ChatMessage } from "~/types";

export function AgentChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("agent-chat-history");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("agent-chat-history", JSON.stringify(messages));
    }
  }, [messages]);

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50"
          aria-label="Open AI Agent"
        >
          <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-6 sm:left-6 bg-white sm:rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col transition-all ${
            isMinimized ? "h-16" : "h-[100vh] sm:h-[600px]"
          } w-full sm:w-96 md:w-[28rem] lg:w-[32rem]`}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white px-4 py-3 sm:rounded-t-xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold">PropMate AI Agent</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content - only show when not minimized */}
          {!isMinimized && (
            <div className="flex-1 overflow-hidden">
              <AgentChat messages={messages} setMessages={setMessages} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
