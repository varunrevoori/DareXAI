import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    await request.jwtVerify();
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
};
