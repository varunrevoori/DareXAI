import { FastifyInstance } from 'fastify';
import { botController } from '../controllers/botController';

export async function botRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.post('/', botController.createBot);
  fastify.get('/', botController.getBots);
  fastify.get('/:id', botController.getBot);
  fastify.put('/:id', botController.updateBot);
  fastify.delete('/:id', botController.deleteBot);
}
