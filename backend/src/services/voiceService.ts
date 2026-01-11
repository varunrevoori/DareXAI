import { config } from '../config';
import { documentService } from './documentService';

class VoiceService {
  // Mock or real Deepgram Speech-to-Text
  async speechToText(audioBase64: string): Promise<string> {
    try {
      // If API key is not set, return mock data
      if (!config.deepgramApiKey) {
        console.log('⚠️  Deepgram API key not set, using mock STT');
        return 'This is a mock transcription of the user speech.';
      }

      // Real Deepgram implementation
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${config.deepgramApiKey}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBuffer,
      });

      const data = await response.json() as any;
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      
      return transcript;
    } catch (error) {
      console.error('STT Error:', error);
      console.log('⚠️  Falling back to mock STT due to error');
      return 'This is a mock transcription of the user speech.';
    }
  }

  // Mock or real Gemini LLM Response with RAG
  async generateLLMResponse(
    userMessage: string,
    systemPrompt: string,
    model: string = 'gemini-2.5-flash',
    temperature: number = 0.7,
    botId?: string
  ): Promise<string> {
    try {
      // 1. Search for relevant context from documents (RAG)
      let contextFromDocuments = '';
      if (botId) {
        try {
          console.log('🔍 Searching documents for context...');
          // Retrieve top 8 most relevant chunks to capture skills, projects, certifications, etc.
          const relevantChunks = await documentService.searchDocuments(botId, userMessage, 8);
          
          if (relevantChunks.length > 0) {
            console.log(`📚 Found ${relevantChunks.length} relevant document chunks`);
            
            // Group chunks by document for better organization
            const chunksByDoc = relevantChunks.reduce((acc, chunk) => {
              if (!acc[chunk.filename]) {
                acc[chunk.filename] = [];
              }
              acc[chunk.filename].push(chunk.content);
              return acc;
            }, {} as Record<string, string[]>);
            
            contextFromDocuments = '\n\nREFERENCE INFORMATION FROM DOCUMENTS:\n';
            contextFromDocuments += '='.repeat(50) + '\n';
            
            Object.entries(chunksByDoc).forEach(([filename, chunks]) => {
              contextFromDocuments += `\nFrom: ${filename}\n`;
              contextFromDocuments += '-'.repeat(40) + '\n';
              chunks.forEach((content, idx) => {
                contextFromDocuments += `${content}\n\n`;
              });
            });
            
            contextFromDocuments += '='.repeat(50) + '\n';
          } else {
            console.log('📭 No relevant documents found');
          }
        } catch (ragError) {
          console.log('⚠️  RAG search failed, continuing without document context:', ragError instanceof Error ? ragError.message : 'Unknown error');
        }
      }

      // If API key is not set, return mock data
      if (!config.geminiApiKey) {
        console.log('⚠️  Gemini API key not set, using mock LLM');
        if (contextFromDocuments) {
          return `This is a mock AI response to: "${userMessage}"\n\nBased on the uploaded documents, I found relevant information.`;
        }
        return `This is a mock AI response to: "${userMessage}"`;
      }

      console.log('🤖 Calling Gemini API with key:', config.geminiApiKey.substring(0, 10) + '...');

      // 2. Build enhanced prompt with document context
      const contextInstruction = contextFromDocuments
        ? `${contextFromDocuments}\n\n=== HOW TO USE THIS INFORMATION ===
You have access to detailed reference materials above. When answering questions:
• Draw from ALL relevant sections - don't just pick one part
• Weave information together naturally like you're telling a story
• Use specific details and facts from the documents
• If the question relates to the uploaded content, that's your primary source
• Combine multiple pieces to give complete, thorough answers
`
        : '';

      const conversationStyle = `\n\n=== CRITICAL SPEAKING RULES ===
You are speaking out loud to someone. This will be converted to voice audio.

STRICT FORMATTING RULES:
❌ NEVER use: ** (bold), * (italic), # (headers), - (bullets), _ (underscores)
❌ NEVER use: numbered lists (1., 2., 3.), bullet points, or any symbols
❌ NEVER write section titles, headers, or labeled categories
✅ ALWAYS speak in flowing, natural sentences like telling a story

NATURAL CONVERSATION STYLE:
• Talk like you're chatting with a friend over coffee
• Use conversational phrases: "So here's the thing", "You know what's interesting", "Let me tell you about"
• Connect ideas naturally: "And another thing", "Plus", "On top of that", "What's cool is"
• When listing things, say: "There are three main things here. First, there's... Then you've got... And finally..."
• Share information like telling a story, not reading a document
• Be warm, helpful, and genuinely interested
• Keep your tone natural and human - never robotic or scripted

REMEMBER: This will be spoken aloud. Write exactly how you would say it to a person.`;

      const enhancedPrompt = `${systemPrompt}${contextInstruction}${conversationStyle}\n\n=== THE CONVERSATION ===\nPerson: ${userMessage}\n\nYou:`;

      console.log('📝 Prompt:', enhancedPrompt.substring(0, 150) + '...');

      // Real Gemini implementation
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${config.geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: enhancedPrompt }
                ]
              }
            ],
            generationConfig: {
              temperature,
              maxOutputTokens: 800,  // Increased from 500 to allow longer, more detailed responses
            },
          }),
        }
      );

      console.log('📡 Gemini API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Gemini API error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as any;
      console.log('✅ Gemini API response received:', JSON.stringify(data).substring(0, 200));
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
      
      // Clean any markdown formatting for voice output
      text = this.cleanTextForVoice(text);
      
      console.log('🎤 Cleaned voice text:', text.substring(0, 100) + '...');
      return text.trim();
    } catch (error) {
      console.error('LLM Error:', error);
      console.log('⚠️  Falling back to mock LLM due to error');
      return `This is a mock AI response to: "${userMessage}"`;
    }
  }

  // Clean text for natural voice output - remove all markdown formatting
  private cleanTextForVoice(text: string): string {
    return text
      // Remove bold/italic markdown (**text**, *text*, __text__, _text_)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove headers (# Header)
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      // Remove bullet points and convert to flowing text
      .replace(/^[\s]*[-*+]\s+(.+)$/gm, '$1. ')
      // Remove numbered lists formatting
      .replace(/^[\s]*\d+\.\s+(.+)$/gm, '$1. ')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove extra line breaks (keep paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace from each line
      .split('\n').map(line => line.trim()).join('\n')
      // Convert multiple spaces to single space
      .replace(/  +/g, ' ');
  }

  // Mock or real ElevenLabs Text-to-Speech
  async textToSpeech(text: string, voiceId: string): Promise<string> {
    try {
      // If API key is not set, return empty string (frontend will use browser TTS)
      if (!config.elevenlabsApiKey) {
        console.log('⚠️  ElevenLabs API key not set, frontend will use browser TTS');
        return '';
      }

      // Real ElevenLabs implementation
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': config.elevenlabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error('TTS API request failed');
      }

      // Convert audio to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      
      // Return data URL
      return `data:audio/mpeg;base64,${base64Audio}`;
    } catch (error) {
      console.error('TTS Error:', error);
      console.log('⚠️  Falling back to browser TTS due to error');
      return '';
    }
  }
}

export const voiceService = new VoiceService();
