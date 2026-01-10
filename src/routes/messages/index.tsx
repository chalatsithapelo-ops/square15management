import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { MessageSquare, Plus, User, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/messages/")({
  component: MessagesPage,
});

function MessagesPage() {
  const { user, token } = useAuthStore();
  const trpc = useTRPC();

  const conversationsQuery = useQuery(
    trpc.getConversations.queryOptions({
      token: token!,
    })
  );

  const conversations = conversationsQuery.data || [];

  const getOtherParticipants = (participants: any[]) => {
    return participants.filter((p) => p.id !== user?.id);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageDate.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-md">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                <p className="text-sm text-gray-600">
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto flex items-stretch gap-2">
              <Link
                to={
                  user?.role === "ADMIN"
                    ? "/admin/dashboard"
                    : user?.role === "ARTISAN"
                    ? "/artisan/dashboard"
                    : "/customer/dashboard"
                }
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Back to Dashboard
              </Link>
              <Link
                to="/"
                onClick={() => useAuthStore.getState().clearAuth()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {conversationsQuery.isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <MessageSquare className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
            <p className="text-sm text-gray-600 mb-6">
              Start a conversation with an artisan or administrator
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => {
              const otherParticipants = getOtherParticipants(conversation.participants);
              const lastMessage = conversation.lastMessage;

              return (
                <Link
                  key={conversation.id}
                  to="/messages/$conversationId"
                  params={{ conversationId: conversation.id.toString() }}
                  className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between">
                    <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-2 sm:p-3">
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {otherParticipants.length > 0
                              ? otherParticipants
                                  .map((p) => `${p.firstName} ${p.lastName}`)
                                  .join(", ")
                              : "Conversation"}
                          </h3>
                          {conversation.unreadCount > 0 && (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mb-2">
                          {otherParticipants.map((p, idx) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 mr-2"
                            >
                              {p.role}
                            </span>
                          ))}
                        </div>
                        {lastMessage ? (
                          <div className="flex flex-col sm:flex-row items-start justify-between">
                            <p className="text-sm text-gray-600 truncate flex-1 pr-4">
                              <span className="font-medium">
                                {lastMessage.sender.id === user?.id
                                  ? "You"
                                  : lastMessage.sender.firstName}
                                :
                              </span>{" "}
                              {lastMessage.content}
                            </p>
                            <div className="flex items-center text-xs text-gray-500 mt-1 sm:mt-0 sm:ml-4 flex-shrink-0">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTimestamp(lastMessage.createdAt)}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No messages yet</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 ml-4 flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
