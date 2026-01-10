import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, X, Bot, Loader2, FileImage, Mic, Square, FileText, Music } from 'lucide-react';
import { ChatMessage } from '~/types';
import { sendMessageToGemini } from '~/services/geminiService';
import { Content } from '@google/genai';

interface AgentChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const AgentChat: React.FC<AgentChatProps> = ({ messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachment, setAttachment] = useState<{file: File, preview: string, type: 'image' | 'pdf' | 'audio'} | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      const fileType = file.type.startsWith('image/') ? 'image' : 
                       file.type === 'application/pdf' ? 'pdf' : 'pdf'; // Default to pdf for other docs

      reader.onload = (event) => {
        setAttachment({
          file,
          preview: event.target?.result as string,
          type: fileType
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setAttachment({
            file: new File([audioBlob], "voice_command.webm", { type: 'audio/webm' }),
            preview: base64String,
            type: 'audio'
          });
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isProcessing) return;

    // Attachments array construction
    const currentAttachments = attachment ? [{
      mimeType: attachment.file.type,
      data: attachment.preview.split(',')[1] // Remove 'data:mime;base64,' prefix
    }] : [];

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date(),
      attachments: currentAttachments
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachment(null); // Clear UI immediately
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setIsProcessing(true);

    try {
        const historyForApi: Content[] = messages.slice(-10).map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }]
        }));

        const response = await sendMessageToGemini(
            historyForApi, 
            userMsg.text, 
            currentAttachments
        );

        const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: response.text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
        console.error("Agent Error:", error);
        
        // Extract specific error message
        let errorMessage = "I encountered an error processing your request. Please try again.";
        if (error instanceof Error && error.message) {
            errorMessage = error.message;
        }
        
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: `❌ **Error**: ${errorMessage}`,
            timestamp: new Date()
        }]);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white w-full">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-800">AI Assistant</h2>
        </div>
        <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-medium">Gemini 2.5</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
        {messages.length === 0 && (
           <div className="text-center text-gray-400 mt-10 px-4">
               <Bot size={48} className="mx-auto mb-4 opacity-20" />
               <h3 className="text-lg font-semibold text-gray-700 mb-2">PropMate Agent</h3>
               <p className="text-sm mb-3">Your AI-powered assistant for Square 15 Facility Solutions</p>
               <div className="bg-indigo-50 rounded-lg p-4 text-left text-xs space-y-2 max-w-md mx-auto border border-indigo-100">
                 <p className="font-semibold text-indigo-900">I can help you with:</p>
                 <ul className="space-y-1 text-indigo-700">
                   <li>📊 View and manage leads, orders, and projects</li>
                   <li>💰 Check financial metrics and invoices</li>
                   <li>👥 Look up employee information</li>
                   <li>📸 Analyze invoice images and documents</li>
                   <li>🎤 Process voice commands (record and describe)</li>
                   <li>🔍 Search across the entire system</li>
                 </ul>
                 <p className="text-indigo-600 pt-2">Try: "Show me all new leads" or upload an invoice!</p>
               </div>
           </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 shadow-sm text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-2 space-y-2">
                   {msg.attachments.map((att, idx) => {
                     // Simple check for mime type to render appropriately
                     if (att.mimeType.startsWith('image/')) {
                       return (
                        <img 
                          key={idx}
                          src={`data:${att.mimeType};base64,${att.data}`} 
                          alt="Attachment" 
                          className="max-h-48 rounded-lg border border-white/20"
                        />
                       );
                     } else if (att.mimeType.startsWith('audio/')) {
                       return (
                         <div key={idx} className="flex items-center gap-2 bg-white/10 p-2 rounded">
                           <Music size={16} />
                           <span>Voice Note</span>
                         </div>
                       );
                     } else {
                       return (
                         <div key={idx} className="flex items-center gap-2 bg-white/10 p-2 rounded">
                           <FileText size={16} />
                           <span>Document</span>
                         </div>
                       );
                     }
                   })}
                </div>
              )}
              {msg.text && (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-white">
                  <ReactMarkdown>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span className="text-xs text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 bg-white border-t border-gray-100">
        {attachment && (
          <div className="mb-3 flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100 w-full sm:w-fit">
            {attachment.type === 'image' && <FileImage size={16} className="text-indigo-600 flex-shrink-0" />}
            {attachment.type === 'pdf' && <FileText size={16} className="text-red-500 flex-shrink-0" />}
            {attachment.type === 'audio' && <Music size={16} className="text-purple-600 flex-shrink-0" />}
            
            <span className="text-xs text-indigo-800 font-medium truncate flex-1 min-w-0">{attachment.file.name}</span>
            <button onClick={clearAttachment} className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors flex-shrink-0">
              <X size={14} className="text-indigo-600" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex-shrink-0"
            title="Upload image/document"
            disabled={isRecording}
          >
            <Paperclip size={18} className="sm:w-5 sm:h-5" />
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
            />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Recording..." : "Ask or speak..."}
              disabled={isRecording}
              className={`w-full bg-gray-100 border-0 rounded-full py-2 sm:py-2.5 px-3 sm:px-4 pr-10 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm ${isRecording ? 'animate-pulse bg-red-50 text-red-500 placeholder-red-400' : ''}`}
            />
          </div>

          {!input.trim() && !attachment && !isRecording ? (
             <button
                onClick={startRecording}
                className="p-2 sm:p-2.5 rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0"
                title="Hold to record"
             >
               <Mic size={16} className="sm:w-[18px] sm:h-[18px]" />
             </button>
          ) : isRecording ? (
            <button
               onClick={stopRecording}
               className="p-2 sm:p-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all animate-pulse flex-shrink-0"
            >
              <Square size={16} className="sm:w-[18px] sm:h-[18px]" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="p-2 sm:p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all flex-shrink-0"
            >
              <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
