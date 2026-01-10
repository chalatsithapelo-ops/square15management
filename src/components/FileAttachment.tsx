import { FileText, Download, File } from "lucide-react";

interface FileAttachmentProps {
  url: string;
  isOwnMessage: boolean;
}

export function FileAttachment({ url, isOwnMessage }: FileAttachmentProps) {
  const fileName = url.split("/").pop() || "file";
  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";

  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
    fileExtension
  );
  const isPDF = fileExtension === "pdf";

  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 rounded-lg overflow-hidden max-w-xs hover:opacity-90 transition-opacity"
      >
        <img
          src={url}
          alt={fileName}
          className="w-full h-auto object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
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
