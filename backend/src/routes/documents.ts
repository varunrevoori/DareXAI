import { FastifyInstance } from 'fastify';
import { documentController } from '../controllers/documentController';

export const documentRoutes = async (fastify: FastifyInstance) => {
  // Upload document for a bot
  fastify.post(
    '/bots/:botId/documents',
    { preHandler: [fastify.authenticate] },
    documentController.uploadDocument
  );

  // Get all documents for a bot
  fastify.get(
    '/bots/:botId/documents',
    { preHandler: [fastify.authenticate] },
    documentController.getDocuments
  );

  // Delete document
  fastify.delete(
    '/documents/:documentId',
    { preHandler: [fastify.authenticate] },
    documentController.deleteDocument
  );
};
