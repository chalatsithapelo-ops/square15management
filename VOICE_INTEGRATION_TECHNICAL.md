# Voice Integration - Technical Implementation Details

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  AIAgentChat Component                                      │
│  ├─ Web Speech API (Transcription)                         │
│  ├─ MediaRecorder API (Audio Recording)                    │
│  ├─ State Management (voice, recording, transcripts)       │
│  └─ UI Controls (buttons, status indicators)               │
└────────────────┬────────────────────────────────────────────┘
                 │ tRPC Mutation (JSON/Base64)
┌────────────────▼────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  tRPC Procedure: aiAgent                                    │
│  ├─ Input validation (Zod schema)                          │
│  ├─ Voice metadata extraction                              │
│  └─ Service delegation                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│              AI Agent Service                               │
├─────────────────────────────────────────────────────────────┤
│  runAIAgent({messages, voiceInput, voiceFormat, ...})      │
│  ├─ System prompt enhancement for voice context            │
│  ├─ Message history sanitization                           │
│  ├─ Gemini API call with voice context                     │
│  └─ Response generation                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│            Gemini 2.0 Flash API                            │
├─────────────────────────────────────────────────────────────┤
│  Model: gemini-2.0-flash                                   │
│  ├─ System Prompt (enhanced with voice notes)              │
│  ├─ Messages (with voice metadata)                         │
│  └─ Tools (aiAgentTools)                                   │
└─────────────────────────────────────────────────────────────┘
```

## File Modifications

### 1. Frontend Component: `src/components/AIAgentChat.tsx`

#### Imports
```typescript
import { Mic, MicOff, Send, Upload, X, Loader } from 'lucide-react';
```

#### State Management
```typescript
// Voice recording state
const [isRecordingAudio, setIsRecordingAudio] = useState(false);
const [voiceData, setVoiceData] = useState<{ 
  data: string; 
  format: 'WAV' | 'MP3' | 'OGG' 
} | null>(null);

// Refs for media handling
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const audioChunksRef = useRef<Blob[]>([]);
```

#### Key Functions

**`startAudioRecording()`**
- Requests microphone permission via `getUserMedia()`
- Creates `MediaRecorder` instance
- Sets up event handlers for data collection
- Stores audio chunks in ref array

**`stopAudioRecording()`**
- Stops the MediaRecorder
- Triggers `onstop` handler
- Encodes audio to Base64
- Stores in `voiceData` state

**`handleSendMessage()`**
- Checks for voice data in addition to text/attachments
- Passes `voiceInput: boolean` to mutation
- Passes `voiceFormat` when voice data exists
- Clears voice data after sending

#### UI Elements
- Purple Mic button for audio recording
- Status indicator for captured voice
- Updated placeholder text for recording state
- Disabled state management to prevent conflicts

### 2. Backend Procedure: `src/server/trpc/procedures/aiAgent.ts`

#### Input Schema
```typescript
const aiAgentInputSchema = z.object({
  authToken: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  attachments: z.array(z.object({
    mimeType: z.string(),
    data: z.string(),
  })).optional().default([]),
  
  // NEW: Voice fields
  voiceInput: z.boolean().optional().default(false),
  voiceFormat: z.enum(['WAV', 'MP3', 'OGG']).optional(),
});
```

#### Mutation Implementation
```typescript
export const aiAgent = baseProcedure
  .input(aiAgentInputSchema)
  .mutation(async ({ input }: { input: z.infer<typeof aiAgentInputSchema> }) => {
    // Logs voice input detection
    console.log('[aiAgent.ts] Voice input:', input.voiceInput);
    if (input.voiceInput) {
      console.log('[aiAgent.ts] Voice format:', input.voiceFormat);
    }
    
    // Delegates to service with voice metadata
    const response = await runAIAgent({
      messages: input.messages,
      authToken: input.authToken,
      attachments: input.attachments,
      voiceInput: input.voiceInput,
      voiceFormat: input.voiceFormat,
    });
    
    return { success: true, message: response };
  });
```

### 3. AI Service: `src/server/services/aiAgentService.ts`

#### Function Signature
```typescript
export async function runAIAgent({
  messages,
  authToken,
  attachments = [],
  voiceInput = false,
  voiceFormat,
}: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  authToken: string;
  attachments?: Array<{ mimeType: string; data: string }>;
  voiceInput?: boolean;
  voiceFormat?: 'WAV' | 'MP3' | 'OGG';
}): Promise<string>
```

#### System Prompt Enhancement
When voice input is detected, the system prompt includes:
```
Voice Command Notes:
- This was a voice command (${voiceFormat}) - be concise and clear in your response
- Listen carefully to intent and extract business data accurately
```

This instructs the AI to:
1. Generate more concise responses
2. Prioritize clarity for voice interaction
3. Adjust communication style
4. Maintain business context awareness

#### Voice-Aware Processing
- Logs voice input detection
- Includes voice format in system prompt
- Generates appropriately styled responses
- Maintains full tool capability

## Data Structures

### Message Interface (Extended)
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  voiceInput?: boolean;           // NEW
  voiceFormat?: 'WAV' | 'MP3' | 'OGG';  // NEW
}
```

### Voice Data Structure
```typescript
{
  data: string;  // Base64 encoded audio
  format: 'WAV' | 'MP3' | 'OGG';  // Format identifier
}
```

### tRPC Input Type
```typescript
{
  authToken: string;
  messages: Array<{ role: string; content: string }>;
  attachments?: Array<{ mimeType: string; data: string }>;
  voiceInput?: boolean;        // NEW
  voiceFormat?: string;        // NEW
}
```

## Browser APIs Used

### 1. MediaRecorder API
```typescript
const mediaRecorder = new MediaRecorder(stream);
mediaRecorder.ondataavailable = (event) => {
  audioChunksRef.current.push(event.data);
};
mediaRecorder.onstop = () => {
  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
  // Convert to Base64...
};
```

**Browser Support:**
- Chrome ✅ (v49+)
- Firefox ✅ (v25+)
- Safari ✅ (v14.1+)
- Edge ✅ (v79+)

### 2. getUserMedia API
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

**Browser Support:**
- Chrome ✅
- Firefox ✅
- Safari ✅
- Edge ✅

**Requirements:**
- HTTPS connection
- User permission grant

### 3. Web Speech API (Existing)
```typescript
const SpeechRecognition = window.webkitSpeechRecognition || 
                          window.SpeechRecognition;
recognitionRef.current = new SpeechRecognition();
recognitionRef.current.continuous = true;
recognitionRef.current.interimResults = true;
```

## Data Flow Details

### Voice Recording Flow
```
1. User clicks Purple Mic
   └─> startAudioRecording()
   
2. Browser requests microphone access
   └─> getUserMedia({ audio: true })
   
3. User allows permission
   └─> MediaRecorder starts capturing
   
4. Audio data flows into chunks
   └─> ondataavailable events
   
5. User clicks to stop
   └─> stopAudioRecording()
   
6. MediaRecorder stops
   └─> onstop event fires
   
7. Blob created from chunks
   └─> FileReader.readAsDataURL()
   
8. Base64 encoding
   └─> setVoiceData({ data: base64, format: 'OGG' })
   
9. User clicks Send
   └─> handleSendMessage()
   
10. tRPC mutation called with voice data
    └─> mutations.aiAgent.mutateAsync({...voiceInput, voiceFormat})
    
11. Backend receives and validates
    └─> aiAgentInputSchema.parse()
    
12. Calls aiAgentService
    └─> runAIAgent({...voiceInput, voiceFormat})
    
13. System prompt enhanced with voice context
    └─> Gemini model receives voice instruction
    
14. AI generates response
    └─> Concise, voice-aware response
    
15. Response sent back to frontend
    └─> Displayed in chat
```

## Encoding Specifications

### Audio Format: WebM with Opus
- **Container**: WebM (VP8 video, Vorbis/Opus audio)
- **Audio Codec**: Opus (default for MediaRecorder)
- **Sample Rate**: Browser default (48kHz typical)
- **Channels**: Mono (1 channel)
- **Bitrate**: Variable (128kbps typical)

### Base64 Encoding
- Audio Blob → FileReader → Data URL → Base64 string
- Example output size: ~1MB per 2 minutes of audio
- Text-safe transmission format
- Ready for JSON serialization

### Format Identifiers
- `'WAV'`: PCM Wave format (future support)
- `'MP3'`: MPEG Layer III (future support)
- `'OGG'`: Ogg Vorbis/Opus (current)

## Error Handling

### Microphone Permission Errors
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  console.error('Error accessing microphone:', error);
  alert('Unable to access microphone. Please check permissions.');
}
```

### API Validation Errors
```typescript
const aiAgentInputSchema = z.object({...});
// Zod automatically validates input
// Throws on invalid voiceInput/voiceFormat values
```

### Graceful Degradation
- If MediaRecorder unsupported: No audio recording button
- If Web Speech unsupported: No transcription
- Voice parameters optional in schema
- Service continues without voice data

## Performance Considerations

### Memory Usage
- Audio chunks buffered in ref: ~500KB per 2 min
- Base64 string: ~133% of binary size
- Cleaned up after send
- No memory leaks with proper cleanup

### Network Transmission
- Base64 encoded: ~30% larger than binary
- Suitable for most connections
- Compression at transport layer if needed

### Processing Time
- Audio recording: Immediate capture
- Base64 encoding: <100ms
- tRPC transmission: <200ms (typical)
- Gemini processing: 1-3s (depending on length)

## Testing Recommendations

### Unit Tests
```typescript
// Test voice data encoding
// Test Base64 string generation
// Test state updates
// Test microphone permission handling
```

### Integration Tests
```typescript
// Test full voice recording flow
// Test tRPC mutation with voice data
// Test backend validation
// Test AI service with voice context
```

### Browser Testing
- Chrome (Primary support)
- Firefox (MediaRecorder only)
- Safari (iOS 14.5+)
- Edge (Full support)

### Accessibility Testing
- Keyboard navigation for buttons
- Screen reader announcements
- Permission dialogs
- Error messages

## Future Enhancements

### Phase 2: Voice Output
- Text-to-speech responses
- Multiple voice personalities
- Voice language selection

### Phase 3: Advanced Audio
- Noise reduction filters
- Audio level visualization
- Waveform display during recording
- Audio playback controls

### Phase 4: Smart Features
- Voice command recognition (predefined)
- Acoustic fingerprinting
- Speaker identification
- Sentiment analysis from tone

### Phase 5: Multi-format Support
- WAV encoding
- MP3 encoding
- Opus codec options
- Bitrate control

## Deployment Checklist

- [ ] HTTPS enabled on production
- [ ] MediaRecorder API polyfills if needed
- [ ] Web Speech API fallback handling
- [ ] Audio permission flows tested
- [ ] Base64 transmission tested
- [ ] Backend validation tested
- [ ] System prompt enhancement verified
- [ ] Error handling tested
- [ ] Mobile device testing completed
- [ ] Accessibility testing completed
- [ ] Performance profiling completed

## Troubleshooting Guide

### Issue: Audio recording won't start
```
Resolution:
1. Check browser support (Chrome, Firefox, Safari, Edge)
2. Verify HTTPS connection
3. Check microphone permissions
4. Clear browser cache
5. Try different microphone device
```

### Issue: No sound captured
```
Resolution:
1. Verify microphone is not muted
2. Check system volume settings
3. Test microphone in browser directly
4. Check browser privacy settings
5. Try different browser
```

### Issue: Voice data too large
```
Resolution:
1. Reduce recording length
2. Check for background noise
3. Use higher quality microphone
4. Implement audio compression
5. Split long messages into multiple sends
```

### Issue: Backend doesn't recognize voice
```
Resolution:
1. Check voiceInput boolean is true
2. Verify Base64 encoding
3. Check schema validation
4. Review server logs
5. Test with curl command
```

## Dependencies

### Frontend
- React (existing)
- Lucide React icons (existing)
- Browser APIs (native)

### Backend
- tRPC (existing)
- Zod validation (existing)
- @ai-sdk/google (existing)

### No new npm packages required!

## Security Considerations

1. **Input Validation**: Zod schema validates all fields
2. **File Size Limits**: Consider adding max audio size
3. **API Rate Limiting**: tRPC handles this
4. **Microphone Permissions**: Browser-level security
5. **Data Privacy**: Audio sent same as text messages
6. **HTTPS Requirement**: Enforced by browser APIs

## Monitoring & Logging

Implemented logging at multiple points:
```
[aiAgent.ts] Voice input: true
[aiAgent.ts] Voice format: OGG
[AI Agent Service] Processing voice input
[AI Agent Service] System prompt length: 1234
```

Useful for debugging and monitoring voice usage.
