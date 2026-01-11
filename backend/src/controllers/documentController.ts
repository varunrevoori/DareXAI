import { FastifyRequest, FastifyReply } from 'fastify';
import { documentService } from '../services/documentService';
import { VoiceBot } from '../models/VoiceBot';

export const documentController = {
  // Upload document or URL for a bot
  uploadDocument: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { botId } = request.params as { botId: string };

      // Verify bot ownership
      const bot = await VoiceBot.findOne({
        _id: botId,
        userId: decoded.userId,
      });

      if (!bot) {
        return reply.status(404).send({ error: 'Bot not found' });
      }

      // Check if this is a URL upload (JSON body) or file upload
      const contentType = request.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        // URL upload
        const { url } = request.body as { url: string };
        
        if (!url) {
          return reply.status(400).send({ error: 'URL is required' });
        }

        console.log(`📄 Processing URL: ${url}`);
        const text = await documentService.extractFromURL(url);

        if (!text || text.trim().length === 0) {
          return reply.status(400).send({ error: 'No text content found in URL' });
        }

        // Create document from URL
        const documentId = await documentService.processDocumentFromText(
          botId,
          decoded.userId,
          url,
          text,
          'url'
        );

        return reply.status(201).send({
          message: 'URL processed successfully',
          documentId,
        });
      } else {
        // File upload
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' });
        }

        const filename = data.filename;
        const fileType = filename.split('.').pop()?.toLowerCase() || '';

        if (fileType !== 'pdf') {
          return reply.status(400).send({ error: 'Only PDF files are supported' });
        }

        const buffer = await data.toBuffer();

        // Process document
        const documentId = await documentService.processDocument(
          botId,
          decoded.userId,
          filename,
          buffer,
          fileType
        );

        reply.status(201).send({
          message: 'Document uploaded and processed successfully',
          documentId,
          warning: documentService.isQuotaExceeded() 
            ? 'API quota exceeded - using reduced quality search. Full quality resumes in ' + documentService.getQuotaResetTime() + ' seconds.'
            : undefined,
        });
      }
    } catch (error) {
      console.error('Upload document error:', error);
      
      // Check if it's a quota error
      const isQuotaError = error instanceof Error && 
        (error.message?.includes('quota') || error.message?.includes('429'));
      
      reply.status(isQuotaError ? 429 : 500).send({
        error: isQuotaError 
          ? 'API quota exceeded - document saved but search quality reduced. Try again later.'
          : 'Document upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryAfter: isQuotaError ? documentService.getQuotaResetTime() : undefined,
      });
    }
  },

  // Get all documents for a bot
  getDocuments: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { botId } = request.params as { botId: string };

      // Verify bot ownership
      const bot = await VoiceBot.findOne({
        _id: botId,
        userId: decoded.userId,
      });

      if (!bot) {
        return reply.status(404).send({ error: 'Bot not found' });
      }

      const documents = await documentService.getDocumentsByBot(botId);

      reply.send({ documents });
    } catch (error) {
      console.error('Get documents error:', error);
      reply.status(500).send({
        error: 'Failed to retrieve documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Delete document
  deleteDocument: async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string };
      const { documentId } = request.params as { documentId: string };

      const success = await documentService.deleteDocument(documentId, decoded.userId);

      if (!success) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      reply.send({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete document error:', error);
      reply.status(500).send({
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
