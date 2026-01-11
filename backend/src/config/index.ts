import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/voice-ai-platform',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
  
  // AI API Keys
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
};
