import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { MessageSquare, Send, ArrowLeft, User, Paperclip, X, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { FileAttachment } from "~/components/FileAttachment";

export const Route = createFileRoute("/messages/$conversationId/")({
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = useParams({ from: "/messages/$conversationId/" });
  const { user, token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [messageContent, setMessageContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationIdNum = parseInt(conversationId);

  const messagesQuery = useQuery(
    trpc.getMessages.queryOptions({
      token: token!,
      conversationId: conversationIdNum,
    })
  );

  const conversationsQuery = useQuery(
    trpc.getConversations.queryOptions({
      token: token!,
    })
  );

  const sendMessageMutation = useMutation(
    trpc.sendMessage.mutationOptions({
      onSuccess: () => {
        setMessageContent("");
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

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  // Subscribe to new messages
  useSubscription(
    trpc.messagesSubscription.subscriptionOptions(
      {
        token: token!,
        conversationId: conversationIdNum,
      },
      {
        enabled: true,
        onData: (message) => {
          queryClient.invalidateQueries({
            queryKey: trpc.getMessages.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.getConversations.queryKey(),
          });
        },
        onError: (error) => {
          console.error("Subscription error:", error);
        },
      }
    )
  );

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (conversationIdNum && token) {
      markAsReadMutation.mutate({
        token: token,
        conversationId: conversationIdNum,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIdNum, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require either content or files
    if (!messageContent.trim() && selectedFiles.length === 0) return;

    try {
      setUploadingFiles(true);
      const attachmentUrls: string[] = [];

      // Upload files to MinIO
      for (const file of selectedFiles) {
        try {
          // Get presigned URL
          const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
            token: token!,
            fileName: file.name,
            fileType: file.type,
          });

          // Upload file to MinIO using presigned URL
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

      // Send message with attachments
      sendMessageMutation.mutate({
        token: token!,
        conversationId: conversationIdNum,
        content: messageContent.trim() || " ", // Use space if no content but has attachments
        attachments: attachmentUrls,
      });

      // Clear files after successful send
      setSelectedFiles([]);
      setUploadingFiles(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setUploadingFiles(false);
    }
  };

  const messages = messagesQuery.data || [];
  const conversation = conversationsQuery.data?.find(
    (c) => c.id === conversationIdNum
  );
  const otherParticipants = conversation?.participants.filter(
    (p) => p.id !== user?.id
  );

  const formatMessageTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <Link
                to="/messages"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-md">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                    {otherParticipants && otherParticipants.length > 0
                      ? otherParticipants
                          .map((p) => `${p.firstName} ${p.lastName}`)
                          .join(", ")
                      : "Conversation"}
                  </h1>
                  {otherParticipants && otherParticipants.length > 0 && (
                    <p className="text-xs text-gray-600">
                      {otherParticipants.map((p) => p.role).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Link
              to="/"
              onClick={() => useAuthStore.getState().clearAuth()}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </Link>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {messagesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No messages yet
              </h3>
              <p className="text-sm text-gray-600">
                Start the conversation by sending a message below
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const isOwnMessage = message.sender.id === user?.id;
                const showSender =
                  index === 0 ||
                  messages[index - 1].sender.id !== message.sender.id;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-xs lg:max-w-md ${
                        isOwnMessage ? "order-2" : "order-1"
                      }`}
                    >
                      {showSender && !isOwnMessage && (
                        <div className="text-xs text-gray-600 mb-1 ml-3">
                          {message.sender.firstName} {message.sender.lastName}
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-3 sm:px-4 py-2 ${
                          isOwnMessage
                            ? "bg-blue-600 text-white"
                            : "bg-white border border-gray-200 text-gray-900"
                        }`}
                      >
                        {message.content.trim() && (
                          <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                        )}
                        
                        {/* Render attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="space-y-2 mt-2">
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
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="mb-2 flex flex-nowrap gap-2 overflow-x-auto scrollbar-none touch-pan-x pb-2 -mx-1 px-1">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2 min-w-0"
                >
                  <Paperclip className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 max-w-[120px] sm:max-w-[150px] truncate">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-end space-x-2 sm:space-x-3">
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
              className="flex-shrink-0 text-gray-600 p-2 sm:p-3 rounded-xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0">
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base"
                style={{ minHeight: "44px", maxHeight: "120px" }}
              />
            </div>
            
            <button
              type="submit"
              disabled={
                (!messageContent.trim() && selectedFiles.length === 0) ||
                sendMessageMutation.isPending ||
                uploadingFiles
              }
              className="flex-shrink-0 bg-blue-600 text-white p-2.5 sm:p-3 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingFiles ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
