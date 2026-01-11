import { FastifyRequest, FastifyReply } from 'fastify';
import { VoiceBot } from '../models/VoiceBot';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { voiceService } from '../services/voiceService';

export const voiceController = {
  // Process voice input and generate response
  processVoice: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { conversationId, audioBase64 } = request.body as {
        conversationId: string;
        audioBase64: string;
      };

      if (!conversationId || !audioBase64) {
        return reply.status(400).send({ error: 'Conversation ID and audio data are required' });
      }

      // Verify conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: decoded.userId,
      }).populate('botId');

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const bot = conversation.botId as any;

      // Step 1: Convert speech to text (Deepgram)
      const userText = await voiceService.speechToText(audioBase64);

      // Validate that we have text content
      if (!userText || userText.trim().length === 0) {
        return reply.status(400).send({ 
          error: 'Failed to transcribe audio. Please try speaking again.' 
        });
      }

      // Save user message
      await Message.create({
        conversationId,
        role: 'user',
        content: userText,
      });

      // Fix old bots with outdated model names
      let llmModel = bot.llmModel;
      if (llmModel === 'gemini-pro' || llmModel === 'gemini-1.5-flash' || llmModel === 'gemini-1.5-flash-latest' || llmModel === 'gemini-2.0-flash-exp') {
        llmModel = 'gemini-2.5-flash';
      }

      // Step 2: Get LLM response (Gemini) with RAG
      const assistantText = await voiceService.generateLLMResponse(
        userText,
        bot.systemPrompt,
        llmModel,
        bot.temperature,
        bot._id.toString()  // Pass botId for RAG search
      );

      // Validate assistant response
      if (!assistantText || assistantText.trim().length === 0) {
        return reply.status(500).send({ 
          error: 'Failed to generate response. Please try again.' 
        });
      }

      // Step 3: Convert text to speech (ElevenLabs)
      const audioUrl = await voiceService.textToSpeech(assistantText, bot.voiceId);

      // Save assistant message
      await Message.create({
        conversationId,
        role: 'assistant',
        content: assistantText,
        audioUrl,
      });

      reply.send({
        userText,
        assistantText,
        audioUrl,
      });
    } catch (error) {
      console.error('Process voice error:', error);
      reply.status(500).send({ 
        error: 'Voice processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },
};
