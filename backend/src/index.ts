import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { config } from './config';
import { connectDB } from './config/database';
import { authenticate } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { botRoutes } from './routes/bots';
import { conversationRoutes } from './routes/conversations';
import { voiceRoutes } from './routes/voice';
import { documentRoutes } from './routes/documents';
import { chromaService } from './services/chromaService';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

const buildServer = (): FastifyInstance => {
  const fastify = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'info' : 'error',
    },
  });

  return fastify;
};

const startServer = async () => {
  const fastify = buildServer();

  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize ChromaDB (non-blocking - will fall back to MongoDB if unavailable)
    console.log('🔮 Initializing ChromaDB...');
    chromaService.initialize().catch(err => {
      console.warn('⚠️  ChromaDB initialization failed, continuing with MongoDB-based search');
    });

    // Register plugins
    await fastify.register(helmet);
    await fastify.register(cors, {
      origin: config.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '15 minutes',
    });
    await fastify.register(jwt, {
      secret: config.jwtSecret,
    });
    await fastify.register(multipart);

    // Register authentication decorator
    fastify.decorate('authenticate', authenticate);

    // Health check
    fastify.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(botRoutes, { prefix: '/api/bots' });
    await fastify.register(conversationRoutes, { prefix: '/api/conversations' });
    await fastify.register(voiceRoutes, { prefix: '/api/voice' });
    await fastify.register(documentRoutes, { prefix: '/api' });

    // Start server
    await fastify.listen({
      port: Number(config.port),
      host: '0.0.0.0',
    });

    // Check ChromaDB status after a brief delay
    setTimeout(async () => {
      const chromaStatus = chromaService.isConnected() ? 'Connected ✅' : 'Not Available ⚠️';
      
      console.log(`on port ${config.port} in ${config.nodeEnv} mode`);
    }, 1000);
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();
