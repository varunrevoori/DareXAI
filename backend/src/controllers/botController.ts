import { FastifyRequest, FastifyReply } from 'fastify';
import { VoiceBot } from '../models/VoiceBot';

export const botController = {
  // Create a new voice bot
  createBot: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { name, systemPrompt, voiceId, voiceModel, llmModel, temperature } = request.body as {
        name: string;
        systemPrompt: string;
        voiceId: string;
        voiceModel?: string;
        llmModel?: string;
        temperature?: number;
      };

      if (!name || !systemPrompt) {
        return reply.status(400).send({ error: 'Name and system prompt are required' });
      }

      const bot = await VoiceBot.create({
        userId: decoded.userId,
        name,
        systemPrompt,
        voiceId: voiceId || 'default-voice',
        voiceModel,
        llmModel,
        temperature,
      });

      reply.status(201).send({
        message: 'Voice bot created successfully',
        bot,
      });
    } catch (error) {
      console.error('Create bot error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Get all bots for current user
  getBots: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const bots = await VoiceBot.find({ userId: decoded.userId }).sort({ createdAt: -1 });

      reply.send({ bots });
    } catch (error) {
      console.error('Get bots error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Get single bot by ID
  getBot: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };

      const bot = await VoiceBot.findOne({ _id: id, userId: decoded.userId });

      if (!bot) {
        return reply.status(404).send({ error: 'Bot not found' });
      }

      reply.send({ bot });
    } catch (error) {
      console.error('Get bot error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Update bot
  updateBot: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };
      const updates = request.body as Partial<{
        name: string;
        systemPrompt: string;
        voiceId: string;
        voiceModel: string;
        llmModel: string;
        temperature: number;
      }>;

      const bot = await VoiceBot.findOneAndUpdate(
        { _id: id, userId: decoded.userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!bot) {
        return reply.status(404).send({ error: 'Bot not found' });
      }

      reply.send({
        message: 'Bot updated successfully',
        bot,
      });
    } catch (error) {
      console.error('Update bot error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Delete bot
  deleteBot: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };

      const bot = await VoiceBot.findOneAndDelete({ _id: id, userId: decoded.userId });

      if (!bot) {
        return reply.status(404).send({ error: 'Bot not found' });
      }

      reply.send({ message: 'Bot deleted successfully' });
    } catch (error) {
      console.error('Delete bot error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },
};
