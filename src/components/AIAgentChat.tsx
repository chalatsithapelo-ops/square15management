import React, { useState, useRef, useEffect } from 'react';
import { useTRPC } from '~/trpc/react';
import { useAuthStore } from '~/stores/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Mic, MicOff, Send, Upload, X, Loader, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  voiceInput?: boolean;
  voiceFormat?: 'WAV' | 'MP3' | 'OGG';
}

interface FileAttachment {
  mimeType: string;
  data: string;
  name: string;
}

interface AIAgentChatProps {
  isWidget?: boolean;
}

export function AIAgentChat({ isWidget = false }: AIAgentChatProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { token: authToken } = useAuthStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [transcript, setTranscript] = useState('');
  const [showUploadButton, setShowUploadButton] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [voiceData, setVoiceData] = useState<{ data: string; format: 'WAV' | 'MP3' | 'OGG' } | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Get or create AI Agent conversation on mount
  const getConversationMutation = useMutation(
    trpc.getOrCreateAIAgentConversation.mutationOptions({
      onSuccess: (data) => {
        setConversationId(data.id);
        // Load existing messages from conversation
        if (data.messages && data.messages.length > 0) {
          const loadedMessages: Message[] = data.messages.map((msg: any) => ({
            role: msg.sender.email === 'ai-agent@system.local' ? 'assistant' : 'user',
            content: msg.content,
            timestamp: new Date(msg.createdAt),
          }));
          setMessages(loadedMessages);
        }
      },
      onError: (error) => {
        setErrorMessage(`Failed to load conversation: ${error.message}`);
      },
    })
  );

  // Initialize conversation on component mount
  useEffect(() => {
    if (authToken && !conversationId) {
      getConversationMutation.mutate({ token: authToken });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, conversationId]);

  const aiAgentMutation = useMutation(
    trpc.aiAgent.mutationOptions({
      onSuccess: (response) => {
        if (response.success) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: response.message,
              timestamp: new Date(),
            },
          ]);
          setErrorMessage(null);
        } else {
          // Show error in UI but don't add to conversation history
          setErrorMessage(response.message);
        }
        setIsLoading(false);
      },
      onError: (error) => {
        // Show error in UI but don't add to conversation history
        setErrorMessage(`Error: ${error.message}`);
        setIsLoading(false);
      },
    })
  );

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setTranscript((prev) => prev + ' ' + transcript);
          } else {
            interim += transcript;
          }
        }
        if (interim) {
          setInput((prev) => (prev + ' ' + interim).trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcript) {
          setInput((prev) => (prev + ' ' + transcript).trim());
          setTranscript('');
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [transcript]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleVoiceInput = async () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        recognitionRef.current.start();
      }
    } else {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event: any) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (base64) {
            setVoiceData({
              data: base64,
              format: 'OGG', // WebM/OGG format from MediaRecorder
            });
          }
        };
        
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach((track: any) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (base64) {
          setAttachments((prev) => [
            ...prev,
            {
              mimeType: file.type,
              data: base64,
              name: file.name,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!input.trim() && attachments.length === 0 && !voiceData) return;
    if (!authToken) return;

    const userMessage: Message = {
      role: 'user',
      content: input || (attachments.length > 0 ? `Uploaded ${attachments.length} file(s)` : 'Voice message'),
      timestamp: new Date(),
      voiceInput: !!voiceData,
      voiceFormat: voiceData?.format,
    };

    setMessages((prev: any) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiAgentMutation.mutateAsync({
        authToken,
        conversationId: conversationId || undefined, // Send undefined if not set, server will create it
        messages: messages.concat(userMessage).map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        attachments: attachments.map((a: any) => ({
          mimeType: a.mimeType,
          data: a.data,
        })),
        voiceInput: !!voiceData,
        voiceFormat: voiceData?.format,
      });

      // Update conversationId if it was just created
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId);
      }

      setAttachments([]);
      setVoiceData(null);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const downloadChat = () => {
    const chatContent = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(chatContent)}`);
    element.setAttribute('download', `ai-agent-chat-${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={`flex flex-col ${isWidget ? 'h-full bg-white' : 'h-screen bg-gradient-to-br from-blue-50 to-indigo-50'}`}>
      {/* Header - only show in full-screen mode */}
      {!isWidget && (
        <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Agent Assistant</h1>
              <p className="text-sm text-gray-600 mt-1">
                Ask questions, create leads, manage employees, invoices, orders, and more
              </p>
            </div>
            <button
              onClick={downloadChat}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              disabled={messages.length === 0}
            >
              <Download size={18} />
              Download Chat
            </button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-full mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Hi I am Your AI Assistant</h2>
              <p className="text-gray-600 max-w-md">
                I can help you with CRM, HR, Finance, and Operations tasks. Try asking me to create leads,
                manage employees, generate invoices, or analyze your business performance.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white text-gray-900 rounded-bl-none border border-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.timestamp && (
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-indigo-100' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 rounded-lg rounded-bl-none border border-gray-200 px-4 py-3 flex items-center gap-2">
              <Loader size={18} className="animate-spin" />
              <span>AI Agent is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-blue-300">
                <span className="text-sm text-gray-700">{attachment.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-6 shadow-lg">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isListening ? 'Listening... (click mic to stop)' : isRecordingAudio ? 'Recording audio... (click stop to finish)' : 'Type or use voice... Press Shift+Enter for new line'}
            disabled={isLoading}
            rows={3}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 resize-none"
          />

          <div className="flex flex-col gap-2">
            <button
              onClick={toggleVoiceInput}
              disabled={isLoading || isRecordingAudio}
              className={`p-2 rounded-lg transition ${
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-50`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
              disabled={isLoading}
              className={`p-2 rounded-lg transition ${
                isRecordingAudio
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              } disabled:opacity-50`}
              title={isRecordingAudio ? 'Stop recording' : 'Record audio'}
            >
              {isRecordingAudio ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
              title="Upload file"
            >
              <Upload size={20} />
            </button>

            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!input.trim() && attachments.length === 0 && !voiceData)}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              title="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {voiceData && (
          <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded">
            <p className="text-sm text-purple-700">
              ✓ Voice recording captured ({voiceData.format})
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json"
        />
      </div>
    </div>
  );
}
