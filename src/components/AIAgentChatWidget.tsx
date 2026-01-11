import { useState, Suspense } from "react";
import { Sparkles, X, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { AIAgentChat } from "~/components/AIAgentChat";

function AIAgentChatContent() {
  return (
    <div className="flex-1 overflow-hidden">
      <AIAgentChat isWidget={true} />
    </div>
  );
}

export function AIAgentChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  // Don't render if user isn't loaded yet
  if (!user || !token) {
    return null;
  }

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  // Determine the correct AI Agent route based on user role
  const aiAgentRoute = 
    user?.role === "PROPERTY_MANAGER" 
      ? "/property-manager/ai-agent" 
      : user?.role === "CONTRACTOR"
      ? "/contractor/ai-agent"
      : "/admin/ai-agent";

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 bg-gradient-to-br from-cyan-500 to-cyan-700 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 z-[9999] group"
          aria-label="Open AI Agent"
        >
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="absolute left-full ml-3 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            AI Agent (27 tools)
          </span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-6 sm:left-6 bg-white sm:rounded-xl shadow-2xl border border-gray-200 z-[10000] flex flex-col transition-all ${
            isMinimized ? "h-16" : "h-[100vh] sm:h-[500px]"
          } w-full sm:w-96 md:w-[26rem] lg:w-[28rem]`}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white px-4 py-3 sm:rounded-t-xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">AI Agent Assistant</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">27 Tools</span>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                to={aiAgentRoute}
                className="text-white hover:bg-white/20 rounded p-1 transition-all"
                aria-label="Open fullscreen"
                title="Open in fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-white/20 rounded p-1 transition-all"
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
                className="text-white hover:bg-white/20 rounded p-1 transition-all"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content - only show when not minimized */}
          {!isMinimized && (
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading AI Agent...</p>
                </div>
              </div>
            }>
              <AIAgentChatContent />
            </Suspense>
          )}
        </div>
      )}
    </>
  );
}
