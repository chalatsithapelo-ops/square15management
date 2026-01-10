import { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
} from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";

interface CampaignEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const personalizationTokens = [
  { token: "{{customerName}}", description: "Customer's full name" },
  { token: "{{customerEmail}}", description: "Customer's email" },
  { token: "{{customerPhone}}", description: "Customer's phone" },
  { token: "{{address}}", description: "Customer's address" },
  { token: "{{serviceType}}", description: "Service type" },
  { token: "{{description}}", description: "Service description" },
  { token: "{{estimatedValue}}", description: "Estimated value" },
];

export function CampaignEditor({ value, onChange, placeholder }: CampaignEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTokens, setShowTokens] = useState(false);
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const getUploadUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to prepare file upload");
      },
    })
  );

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertToken = (token: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const tokenNode = document.createElement("span");
      tokenNode.className = "inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm font-mono";
      tokenNode.textContent = token;
      tokenNode.contentEditable = "false";
      
      range.insertNode(tokenNode);
      
      // Move cursor after the token
      range.setStartAfter(tokenNode);
      range.setEndAfter(tokenNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    handleInput();
    setShowTokens(false);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const insertImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      toast.loading('Uploading image...', { id: 'image-upload' });

      // Get presigned URL
      const { presignedUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
        token: token!,
        fileName: file.name,
        fileType: file.type,
        isPublic: true,
      });

      // Upload file to MinIO
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // Insert image into editor
      execCommand("insertImage", fileUrl);
      
      toast.success('Image uploaded successfully', { id: 'image-upload' });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image', { id: 'image-upload' });
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    // Get pasted HTML content
    const html = event.clipboardData.getData('text/html');
    
    if (!html) return; // Let default paste behavior handle plain text

    // Check if HTML contains base64 images
    const base64ImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/g;
    const matches = Array.from(html.matchAll(base64ImageRegex));

    if (matches.length === 0) return; // No base64 images, let default paste happen

    // Prevent default paste to handle it ourselves
    event.preventDefault();

    toast.loading(`Processing ${matches.length} image(s)...`, { id: 'paste-images' });

    try {
      let processedHtml = html;

      // Process each base64 image
      for (const match of matches) {
        const [fullMatch, imageType, base64Data] = match;
        
        try {
          // Convert base64 to blob
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: `image/${imageType}` });

          // Create a file from blob
          const fileName = `pasted-image-${Date.now()}.${imageType}`;
          const file = new File([blob], fileName, { type: `image/${imageType}` });

          // Get presigned URL
          const { presignedUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
            token: token!,
            fileName: fileName,
            fileType: `image/${imageType}`,
            isPublic: true,
          });

          // Upload to MinIO
          const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': `image/${imageType}`,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
          }

          // Replace base64 src with MinIO URL
          processedHtml = processedHtml.replace(fullMatch, `<img src="${fileUrl}"`);
        } catch (error) {
          console.error('Failed to process pasted image:', error);
          // Continue with other images even if one fails
        }
      }

      // Insert the processed HTML
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const div = document.createElement('div');
        div.innerHTML = processedHtml;
        
        const fragment = document.createDocumentFragment();
        let node;
        while ((node = div.firstChild)) {
          fragment.appendChild(node);
        }
        
        range.insertNode(fragment);
      }

      handleInput();
      toast.success(`${matches.length} image(s) processed successfully`, { id: 'paste-images' });
    } catch (error) {
      console.error('Paste processing error:', error);
      toast.error('Failed to process pasted content', { id: 'paste-images' });
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-300 p-2 flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => execCommand("bold")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("italic")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("underline")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => execCommand("justifyLeft")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("justifyCenter")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("justifyRight")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => execCommand("insertUnorderedList")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("insertOrderedList")}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                execCommand("formatBlock", e.target.value);
                e.target.value = "";
              }
            }}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
          >
            <option value="">Heading</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="p">Paragraph</option>
          </select>
        </div>

        {/* Insert */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={insertLink}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Insert Link"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={insertImage}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Upload Image"
          >
            <Image className="h-4 w-4" />
          </button>
        </div>

        {/* Personalization Tokens */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTokens(!showTokens)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
            title="Insert Personalization Token"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Insert Token
          </button>
          
          {showTokens && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
              <div className="p-2">
                <p className="text-xs text-gray-600 mb-2 font-medium">Click to insert:</p>
                {personalizationTokens.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => insertToken(item.token)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded transition-colors"
                  >
                    <code className="text-xs font-mono text-blue-800 font-semibold block">
                      {item.token}
                    </code>
                    <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Editor Content */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[400px] p-4 focus:outline-none prose prose-sm max-w-none"
        style={{
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
