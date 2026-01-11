import { FastifyInstance } from 'fastify';
import { voiceController } from '../controllers/voiceController';

export async function voiceRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/process', voiceController.processVoice);
}
