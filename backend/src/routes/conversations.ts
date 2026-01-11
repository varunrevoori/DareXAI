import { FastifyInstance } from 'fastify';
import { conversationController } from '../controllers/conversationController';

export async function conversationRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/', conversationController.createConversation);
  fastify.get('/', conversationController.getConversations);
  fastify.get('/:id', conversationController.getConversation);
  fastify.put('/:id/end', conversationController.endConversation);
  fastify.get('/:id/messages', conversationController.getMessages);
  fastify.post('/:id/messages', conversationController.addMessage);
}
