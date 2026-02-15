import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useAuthStore } from "~/stores/auth";
import {
  MessageSquare,
  X,
  Send,
  Paperclip,
  Loader2,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { FileAttachment } from "~/components/FileAttachment";

export function SupportChatWidget() {
  const { user, token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All hooks must be called unconditionally
  const conversationsQuery = useQuery(
    trpc.getConversations.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      retry: 1,
    })
  );

  const messagesQuery = useQuery(
    trpc.getMessages.queryOptions(
      {
        token: token!,
        conversationId: selectedConversationId || 0,
      },
      {
        enabled: !!selectedConversationId && !!token,
        retry: 1,
      }
    )
  );

  const adminsQuery = useQuery(
    trpc.getAdmins.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      retry: false,
      refetchOnWindowFocus: false,
    })
  );

  const sendMessageMutation = useMutation(
    trpc.sendMessage.mutationOptions({
      onSuccess: () => {
        setMessageContent("");
        setSelectedFiles([]);
        queryClient.invalidateQueries({
          queryKey: trpc.getMessages.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getConversations.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send message");
      },
    })
  );

  const markAsReadMutation = useMutation(
    trpc.markMessagesAsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getConversations.queryKey(),
        });
      },
    })
  );

  const createConversationMutation = useMutation(
    trpc.createConversation.mutationOptions({
      onSuccess: (data) => {
        setSelectedConversationId(data.id);
        queryClient.invalidateQueries({
          queryKey: trpc.getConversations.queryKey(),
        });
        toast.success("Support conversation started!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start conversation");
      },
    })
  );

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  // Subscribe to new messages
  useSubscription(
    trpc.messagesSubscription.subscriptionOptions(
      {
        token: token!,
        conversationId: selectedConversationId || 0,
      },
      {
        enabled: !!selectedConversationId && isOpen && !!token,
        onData: () => {
          queryClient.invalidateQueries({
            queryKey: trpc.getMessages.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.getConversations.queryKey(),
          });
        },
      }
    )
  );

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId && token && isOpen) {
      markAsReadMutation.mutate({
        token: token,
        conversationId: selectedConversationId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId, token, isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  // Don't render widget if user is not logged in
  if (!user || !token) {
    return null;
  }

  const conversations = conversationsQuery.data || [];
  
  // Filter to only show conversations with admins (support conversations)
  const supportConversations = conversations.filter((conv) =>
    conv.participants.some((p) => 
      p.id !== user.id && (p.role === "JUNIOR_ADMIN" || p.role === "SENIOR_ADMIN")
    )
  );

  const unreadCount = supportConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const selectedConversation = selectedConversationId
    ? supportConversations.find((c) => c.id === selectedConversationId)
    : null;

  const messages = messagesQuery.data || [];

  const handleStartNewConversation = async () => {
    // Get admins from the admins query
    const admins = adminsQuery.data || [];
    
    if (admins.length === 0) {
      toast.error("No support staff available. Please try again later.");
      return;
    }

    // Pick the first admin (or could implement logic to pick based on availability)
    const adminUser = admins[0];

    createConversationMutation.mutate({
      token: token!,
      participantIds: [adminUser.id],
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedConversationId) return;
    if (!messageContent.trim() && selectedFiles.length === 0) return;

    try {
      setUploadingFiles(true);
      const attachmentUrls: string[] = [];

      // Upload files to MinIO
      for (const file of selectedFiles) {
        try {
          const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
            token: token!,
            fileName: file.name,
            fileType: file.type,
          });

          const uploadResponse = await fetch(presignedUrl, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          attachmentUrls.push(fileUrl);
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}`);
          setUploadingFiles(false);
          return;
        }
      }

      sendMessageMutation.mutate({
        token: token!,
        conversationId: selectedConversationId,
        content: messageContent.trim() || " ",
        attachments: attachmentUrls,
      });

      setSelectedFiles([]);
      setUploadingFiles(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setUploadingFiles(false);
    }
  };

  const formatMessageTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOtherParticipants = (conv: typeof supportConversations[0]) => {
    return conv.participants.filter((p) => p.id !== user.id);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 z-50"
          aria-label="Open support chat"
        >
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-6 sm:right-6 bg-white sm:rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col transition-all ${
            isMinimized ? "h-16" : "h-[100vh] sm:h-[600px]"
          } w-full sm:w-96`}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-t-xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span className="font-semibold">
                {selectedConversation ? "Support Chat" : "Support"}
              </span>
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
                onClick={() => {
                  setIsOpen(false);
                  setSelectedConversationId(null);
                  setIsMinimized(false);
                }}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content - only show when not minimized */}
          {!isMinimized && (
            <>
              {!selectedConversationId ? (
                /* Conversation List */
                <div className="flex-1 overflow-y-auto">
                  {supportConversations.length === 0 ? (
                    <div className="p-6 text-center">
                      <User className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-2">
                        Need help?
                      </h3>
                      <p className="text-xs text-gray-600 mb-4">
                        Start a conversation with our support team
                      </p>
                      <button
                        onClick={handleStartNewConversation}
                        disabled={createConversationMutation.isPending}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {createConversationMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Start Chat
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {supportConversations.map((conv) => {
                        const otherParticipants = getOtherParticipants(conv);
                        const lastMessage = conv.lastMessage;

                        return (
                          <button
                            key={conv.id}
                            onClick={() => setSelectedConversationId(conv.id)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {otherParticipants.length > 0
                                      ? otherParticipants
                                          .map((p) => `${p.firstName} ${p.lastName}`)
                                          .join(", ")
                                      : "Support"}
                                  </p>
                                  {conv.unreadCount > 0 && (
                                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                                      {conv.unreadCount}
                                    </span>
                                  )}
                                </div>
                                {lastMessage && (
                                  <p className="text-xs text-gray-600 truncate">
                                    {lastMessage.sender.id === user.id ? "You: " : ""}
                                    {lastMessage.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      <div className="p-3">
                        <button
                          onClick={handleStartNewConversation}
                          disabled={createConversationMutation.isPending}
                          className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          New Conversation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Chat View */
                <>
                  {/* Back button */}
                  <div className="px-4 py-2 border-b border-gray-200 flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedConversationId(null)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      ← Back
                    </button>
                    {selectedConversation && (
                      <span className="text-sm text-gray-600">
                        {getOtherParticipants(selectedConversation)
                          .map((p) => `${p.firstName} ${p.lastName}`)
                          .join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {messagesQuery.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-600">
                          No messages yet. Start the conversation!
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.sender.id === user.id;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[85%] sm:max-w-[75%]`}>
                              <div
                                className={`rounded-lg px-3 py-2 ${
                                  isOwnMessage
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                {message.content.trim() && (
                                  <p className="text-sm break-words">{message.content}</p>
                                )}
                                
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="space-y-1 sm:space-y-2">
                                    {message.attachments.map((url, idx) => (
                                      <FileAttachment
                                        key={idx}
                                        url={url}
                                        isOwnMessage={isOwnMessage}
                                      />
                                    ))}
                                  </div>
                                )}
                                
                                <p
                                  className={`text-xs mt-1 ${
                                    isOwnMessage ? "text-blue-100" : "text-gray-500"
                                  }`}
                                >
                                  {formatMessageTime(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-gray-200 p-2 sm:p-3 flex-shrink-0">
                    {selectedFiles.length > 0 && (
                      <div className="mb-2 px-2 sm:px-0 flex flex-nowrap gap-1 sm:gap-2 overflow-x-auto pb-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex-shrink-0 flex items-center space-x-1 sm:space-x-2 bg-gray-100 rounded px-2 py-1"
                          >
                            <Paperclip className="h-3 w-3 text-gray-600 flex-shrink-0" />
                            <span className="text-xs text-gray-700 max-w-[100px] truncate">
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFiles}
                        className="flex-shrink-0 text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>

                      <input
                        type="text"
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
                      />

                      <button
                        type="submit"
                        disabled={
                          (!messageContent.trim() && selectedFiles.length === 0) ||
                          sendMessageMutation.isPending ||
                          uploadingFiles
                        }
                        className="flex-shrink-0 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {uploadingFiles ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
