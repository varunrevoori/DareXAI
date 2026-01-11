import { FastifyRequest, FastifyReply } from 'fastify';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

export const conversationController = {
  // Create new conversation
  createConversation: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { botId } = request.body as { botId: string };

      if (!botId) {
        return reply.status(400).send({ error: 'Bot ID is required' });
      }

      const conversation = await Conversation.create({
        botId,
        userId: decoded.userId,
        status: 'active',
      });

      reply.status(201).send({
        message: 'Conversation created',
        conversation,
      });
    } catch (error) {
      console.error('Create conversation error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Get conversations for a bot
  getConversations: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { botId } = request.query as { botId?: string };

      const filter: any = { userId: decoded.userId };
      if (botId) {
        filter.botId = botId;
      }

      const conversations = await Conversation.find(filter)
        .populate('botId', 'name')
        .sort({ startTime: -1 })
        .limit(50);

      reply.send({ conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Get single conversation
  getConversation: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };

      const conversation = await Conversation.findOne({
        _id: id,
        userId: decoded.userId,
      }).populate('botId', 'name systemPrompt');

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      reply.send({ conversation });
    } catch (error) {
      console.error('Get conversation error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // End conversation
  endConversation: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };

      const conversation = await Conversation.findOneAndUpdate(
        { _id: id, userId: decoded.userId },
        { status: 'completed', endTime: new Date() },
        { new: true }
      );

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      // Delete all messages associated with this conversation to save database space
      console.log(`🗑️  Cleaning up messages for conversation ${id}...`);
      const deleteResult = await Message.deleteMany({ conversationId: id });
      console.log(`✅ Deleted ${deleteResult.deletedCount} messages`);

      reply.send({
        message: 'Conversation ended and messages cleaned up',
        conversation,
        messagesDeleted: deleteResult.deletedCount,
      });
    } catch (error) {
      console.error('End conversation error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Get messages for a conversation
  getMessages: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };

      // Verify conversation belongs to user
      const conversation = await Conversation.findOne({
        _id: id,
        userId: decoded.userId,
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const messages = await Message.find({ conversationId: id }).sort({ timestamp: 1 });

      reply.send({ messages });
    } catch (error) {
      console.error('Get messages error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },

  // Add message to conversation
  addMessage: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { id } = request.params as { id: string };
      const { role, content, audioUrl, metadata } = request.body as {
        role: 'user' | 'assistant';
        content: string;
        audioUrl?: string;
        metadata?: any;
      };

      // Verify conversation belongs to user
      const conversation = await Conversation.findOne({
        _id: id,
        userId: decoded.userId,
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const message = await Message.create({
        conversationId: id,
        role,
        content,
        audioUrl,
        metadata,
      });

      reply.status(201).send({
        message: 'Message added',
        data: message,
      });
    } catch (error) {
      console.error('Add message error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  },
};
