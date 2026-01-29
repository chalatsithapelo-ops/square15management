import { FileText, Download, File } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";

interface FileAttachmentProps {
  url: string;
  isOwnMessage: boolean;
}

export function FileAttachment({ url, isOwnMessage }: FileAttachmentProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const fileName = (url.split("/").pop() || "file").split("?")[0] || "file";
  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";

  const isPDF = fileExtension === "pdf";

  const isMinioProxyUrl = url.startsWith("/minio/") || url.includes("/minio/");

  const signedUrlQuery = useQuery(
    trpc.getPresignedDownloadUrl.queryOptions(
      {
        token: token!,
        url,
      },
      {
        enabled: isMinioProxyUrl && !!token,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1,
      }
    )
  );

  const effectiveUrl = signedUrlQuery.data?.url ?? url;

  return (
    <a
      href={effectiveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
        isOwnMessage
          ? "bg-blue-700 hover:bg-blue-800"
          : "bg-gray-100 hover:bg-gray-200"
      }`}
    >
      {isPDF ? (
        <FileText
          className={`h-5 w-5 ${isOwnMessage ? "text-blue-100" : "text-red-600"}`}
        />
      ) : (
        <File
          className={`h-5 w-5 ${isOwnMessage ? "text-blue-100" : "text-gray-600"}`}
        />
      )}
      <span
        className={`text-sm font-medium truncate max-w-[200px] ${
          isOwnMessage ? "text-white" : "text-gray-900"
        }`}
      >
        {fileName}
      </span>
      <Download
        className={`h-4 w-4 flex-shrink-0 ${isOwnMessage ? "text-blue-100" : "text-gray-600"}`}
      />
    </a>
  );
}
