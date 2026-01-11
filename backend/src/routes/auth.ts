import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/authController';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', authController.register);
  fastify.post('/login', authController.login);
  fastify.get('/me', { onRequest: [fastify.authenticate] }, authController.me);
}
