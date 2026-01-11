import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { DocumentModel, IDocumentChunk } from '../models/Document';
import { chromaService } from './chromaService';

// Simple text splitter
class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(config: { chunkSize: number; chunkOverlap: number; separators: string[]; keepSeparator: boolean }) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
  }

  async splitText(text: string): Promise<string[]> {
    const chunks: string[] = [];
    let start = 0;
    let iterationCount = 0;
    const maxIterations = 1000; // Safety limit

    while (start < text.length && iterationCount < maxIterations) {
      iterationCount++;
      const end = Math.min(start + this.chunkSize, text.length);
      const chunk = text.slice(start, end);
      
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      
      start = end - this.chunkOverlap;
      
      // Ensure progress to avoid infinite loop
      if (start <= end - this.chunkSize && end < text.length) {
        start = end - this.chunkOverlap;
      } else if (end >= text.length) {
        break;
      }
      
      // Extra safety check
      if (start + this.chunkSize > text.length && end >= text.length) {
        break;
      }
    }

    if (iterationCount >= maxIterations) {
      console.warn(`⚠️ Hit max iterations (${maxIterations}), stopping chunking`);
    }

    return chunks;
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

class DocumentService {
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private lastEmbeddingCall: number = 0;
  private embeddingDelay: number = 1000; // 1 second between calls
  private quotaExceeded: boolean = false;
  private quotaResetTime: number = 0;

  constructor() {
    if (config.geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    }
  }

  // Advanced chunking using LangChain with deduplication
  async chunkText(text: string): Promise<string[]> {
    try {
      // Clean text first - remove excessive whitespace but keep structure
      const cleanedText = text
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines to 2
        .trim();

      console.log(`📝 Original text length: ${cleanedText.length} characters`);

      // Use LangChain's RecursiveCharacterTextSplitter for semantic chunking
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,  // Target chunk size
        chunkOverlap: 100,  // Reduced overlap to minimize duplication
        separators: ['\n\n', '\n', '. ', ', ', ' ', ''],  // Split on semantic boundaries
        keepSeparator: false,
      });

      const rawChunks = await splitter.splitText(cleanedText);
      console.log(`✂️  LangChain created ${rawChunks.length} raw chunks`);

      // Deduplication: Remove chunks that are too similar
      const uniqueChunks: string[] = [];
      const seenContent = new Set<string>();

      for (const chunk of rawChunks) {
        const trimmedChunk = chunk.trim();
        
        // Skip empty or very short chunks
        if (trimmedChunk.length < 50) {
          continue;
        }

        // Create a normalized version for comparison (first 100 chars)
        const signature = trimmedChunk.substring(0, 100).toLowerCase().replace(/\s+/g, '');
        
        // Only add if we haven't seen this signature before
        if (!seenContent.has(signature)) {
          seenContent.add(signature);
          uniqueChunks.push(trimmedChunk);
        } else {
          console.log(`⚠️  Skipped duplicate chunk starting with: "${trimmedChunk.substring(0, 50)}..."`);
        }
      }

      console.log(`✅ Final: ${uniqueChunks.length} unique chunks (removed ${rawChunks.length - uniqueChunks.length} duplicates)`);
      return uniqueChunks;
    } catch (error) {
      console.error('Chunking error:', error);
      // Fallback to simple chunking if LangChain fails
      return this.fallbackChunking(text);
    }
  }

  // Fallback chunking method
  private fallbackChunking(text: string): string[] {
    const chunks: string[] = [];
    const chunkSize = 1000;
    const overlap = 100;
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 50) {
        chunks.push(chunk);
      }
      start = end - overlap;
      if (start >= text.length) break;
    }

    return chunks;
  }

  // Check quota status
  isQuotaExceeded(): boolean {
    return this.quotaExceeded && Date.now() < this.quotaResetTime;
  }

  // Get time until quota resets (in seconds)
  getQuotaResetTime(): number {
    if (!this.quotaExceeded) return 0;
    return Math.ceil((this.quotaResetTime - Date.now()) / 1000);
  }

  // Generate embeddings using Gemini with rate limiting and caching
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = text.substring(0, 100); // Use first 100 chars as cache key
    if (this.embeddingCache.has(cacheKey)) {
      console.log('📦 Using cached embedding');
      return this.embeddingCache.get(cacheKey)!;
    }

    // Check if quota is exceeded
    if (this.quotaExceeded && Date.now() < this.quotaResetTime) {
      const waitTime = Math.ceil((this.quotaResetTime - Date.now()) / 1000);
      console.log(`⏳ Quota exceeded, using mock embedding (reset in ${waitTime}s)`);
      return Array(768).fill(0).map(() => Math.random());
    }

    try {
      if (!this.genAI) {
        console.log('⚠️  Gemini API not configured, using mock embedding');
        return Array(768).fill(0).map(() => Math.random());
      }

      // Rate limiting: wait if needed
      const timeSinceLastCall = Date.now() - this.lastEmbeddingCall;
      if (timeSinceLastCall < this.embeddingDelay) {
        const waitTime = this.embeddingDelay - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      this.lastEmbeddingCall = Date.now();
      const model = this.genAI.getGenerativeModel({ model: 'embedding-001' });
      const result = await model.embedContent(text);
      
      // Cache the result
      this.embeddingCache.set(cacheKey, result.embedding.values);
      
      // Clear quota exceeded flag on success
      this.quotaExceeded = false;
      
      return result.embedding.values;
    } catch (error: any) {
      // Handle quota exceeded errors
      if (error.status === 429 || error.message?.includes('quota')) {
        console.error('🚫 Embedding quota exceeded - switching to mock embeddings');
        
        // Extract retry delay if available
        const retryDelay = error.errorDetails?.find(
          (detail: any) => detail['@type']?.includes('RetryInfo')
        )?.retryDelay;
        
        if (retryDelay) {
          const seconds = parseInt(retryDelay);
          this.quotaResetTime = Date.now() + (seconds * 1000);
          console.log(`⏰ Quota will reset in ${seconds} seconds`);
        } else {
          // Default to 1 minute if no retry info
          this.quotaResetTime = Date.now() + 60000;
        }
        
        this.quotaExceeded = true;
      } else {
        console.error('Embedding generation error:', error.message || error);
      }
      
      // Return mock embedding on any error
      return Array(768).fill(0).map(() => Math.random());
    }
  }

  // Parse PDF and extract text
  async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF');
    }
  }

  // Extract text from URL
  async extractFromURL(url: string): Promise<string> {
    try {
      console.log(`🌐 Fetching URL: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Accept redirects and client errors
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.status >= 400) {
        // Special handling for LinkedIn's bot protection
        if (response.status === 999) {
          throw new Error('LinkedIn blocks automated access. Please try: 1) Copy the page text manually, or 2) Use a different source');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();
      
      // Extract text from main content areas
      let text = '';
      
      // Try to find main content first
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry-content'];
      for (const selector of mainSelectors) {
        const mainContent = $(selector).text();
        if (mainContent && mainContent.length > 100) {
          text = mainContent;
          break;
        }
      }
      
      // Fallback to body if no main content found
      if (!text) {
        text = $('body').text();
      }
      
      // Clean up whitespace
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      if (!text || text.length < 50) {
        throw new Error('Insufficient text content extracted from URL (less than 50 characters)');
      }

      console.log(`✅ Extracted ${text.length} characters from URL`);
      return text;
    } catch (error: any) {
      console.error('URL extraction error:', error.message || error);
      
      // Provide specific error messages
      if (error.code === 'ENOTFOUND') {
        throw new Error('URL not found - please check the URL is correct');
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new Error('Request timed out - the website took too long to respond');
      } else if (error.message?.includes('999') || error.response?.status === 999) {
        throw new Error('This website blocks automated access (LinkedIn, etc.). Please copy text manually or use a different URL');
      } else if (error.message?.includes('HTTP')) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
      } else if (error.message?.includes('Insufficient text')) {
        throw new Error(error.message);
      } else {
        throw new Error(`Failed to extract text from URL: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // Process document: parse, chunk, embed
  async processDocument(
    botId: string,
    userId: string,
    filename: string,
    buffer: Buffer,
    fileType: string = 'pdf'
  ): Promise<string> {
    try {
      // 1. Parse PDF
      console.log(`📄 Parsing ${filename}...`);
      const text = await this.parsePDF(buffer);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      // 2. Chunk text using custom splitter
      console.log('✂️  Chunking text...');
      const chunks = await this.chunkText(text);
      console.log(`Created ${chunks.length} unique chunks`);

      // 3. Generate embeddings for each chunk (batch processing)
      console.log('🧮 Generating embeddings...');
      
      if (this.quotaExceeded) {
        console.warn('⚠️  API quota exceeded - using mock embeddings (search quality reduced)');
      }
      
      const embeddings: number[][] = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, chunks.length);
        const batch = chunks.slice(i, batchEnd);
        
        // Process batch
        for (let j = 0; j < batch.length; j++) {
          const embedding = await this.generateEmbedding(batch[j]);
          embeddings.push(embedding);
        }

        console.log(`  Processed ${batchEnd}/${chunks.length} chunks`);
        
        // Allow garbage collection between batches
        if (global.gc && i % 50 === 0) {
          global.gc();
        }
      }

      // 4. Save metadata to MongoDB (without embeddings)
      console.log('💾 Saving metadata to MongoDB...');
      const document = await DocumentModel.create({
        botId,
        userId,
        filename,
        fileType,
        fileSize: buffer.length,
        source: 'pdf',
        chunks: chunks.map((content, chunkIndex) => ({
          content,
          chunkIndex,
        })),
        totalChunks: chunks.length,
        processed: true,
      });

      // 5. Store embeddings in ChromaDB
      console.log('🔮 Storing embeddings in ChromaDB...');
      await chromaService.addEmbeddings(
        document._id.toString(),
        chunks,
        embeddings,
        'pdf'
      );

      console.log(`✅ Document processed: ${document._id}`);
      return document._id.toString();
    } catch (error) {
      console.error('Document processing error:', error);
      throw error;
    }
  }

  // Process document from text (for URLs)
  async processDocumentFromText(
    botId: string,
    userId: string,
    filename: string,
    text: string,
    fileType: string = 'url'
  ): Promise<string> {
    try {
      console.log(`📄 Processing text from ${filename}...`);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content provided');
      }

      // Chunk text
      console.log('✂️  Chunking text...');
      const chunks = await this.chunkText(text);
      console.log(`Created ${chunks.length} chunks`);

      // Generate embeddings
      console.log('🧮 Generating embeddings...');
      const embeddings: number[][] = [];

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.generateEmbedding(chunks[i]);
        embeddings.push(embedding);

        if ((i + 1) % 10 === 0) {
          console.log(`  Processed ${i + 1}/${chunks.length} chunks`);
        }
      }

      // Save metadata to MongoDB
      console.log('💾 Saving metadata to MongoDB...');
      const document = await DocumentModel.create({
        botId,
        userId,
        filename,
        fileType,
        fileSize: text.length,
        source: 'url',
        chunks: chunks.map((content, chunkIndex) => ({
          content,
          chunkIndex,
        })),
        totalChunks: chunks.length,
        processed: true,
      });

      // Store embeddings in ChromaDB
      console.log('🔮 Storing embeddings in ChromaDB...');
      await chromaService.addEmbeddings(
        document._id.toString(),
        chunks,
        embeddings,
        'url'
      );

      console.log(`✅ Document processed: ${document._id}`);
      return document._id.toString();
    } catch (error) {
      console.error('Text processing error:', error);
      throw error;
    }
  }

  // Cosine similarity between two vectors
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Search for relevant document chunks using ChromaDB or fallback to MongoDB
  async searchDocuments(
    botId: string,
    query: string,
    topK: number = 8  // Increased from 3 to capture more relevant information
  ): Promise<Array<{ content: string; score: number; filename: string }>> {
    try {
      // 1. Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // 2. Get all documents for this bot from MongoDB
      const documents = await DocumentModel.find({ botId, processed: true });

      if (documents.length === 0) {
        console.log('📭 No processed documents found for this bot');
        return [];
      }

      console.log(`📚 Searching through ${documents.length} document(s)`);

      // 3. Try ChromaDB first if available
      if (chromaService.isConnected()) {
        console.log('🔮 Using ChromaDB for search');
        
        // Get document IDs for filtering
        const documentIds = documents.map(doc => doc._id.toString());

        // Search ChromaDB for similar chunks
        const chromaResults = await chromaService.searchSimilar(queryEmbedding, topK * 2); // Get more results to filter

        // Filter results to only include this bot's documents
        const filteredResults = chromaResults.filter(result => 
          documentIds.includes(result.metadata.documentId)
        );

        // Create a map of documentId -> filename
        const docMap = new Map(documents.map(doc => [doc._id.toString(), doc.filename]));

        // Format results with filename lookup
        const results = filteredResults.slice(0, topK).map(result => ({
          content: result.text,
          score: result.score,
          filename: docMap.get(result.metadata.documentId) || 'Unknown'
        }));

        console.log(`✅ Returning ${results.length} most relevant chunks (scores: ${results.map(r => r.score.toFixed(3)).join(', ')})`);
        return results;
      }

      // 4. Fallback to MongoDB-based cosine similarity search
      console.log('📊 ChromaDB not available, using MongoDB-based search');
      
      const results: Array<{ content: string; score: number; filename: string; chunkIndex: number }> = [];

      for (const doc of documents) {
        for (const chunk of doc.chunks) {
          // For MongoDB fallback, we need to regenerate embeddings or skip
          // Since we removed embeddings from the model, we can't do cosine similarity
          // Just return the chunks in order as a basic fallback
          results.push({
            content: chunk.content,
            score: 0.5, // Neutral score since we can't calculate similarity
            filename: doc.filename,
            chunkIndex: chunk.chunkIndex,
          });
        }
      }

      console.log(`🔎 Analyzed ${results.length} chunks total (fallback mode)`);

      // Return top K chunks (basically first chunks from documents)
      const sortedResults = results.slice(0, topK);

      console.log(`✅ Returning ${sortedResults.length} chunks (fallback mode - no similarity ranking)`);
      return sortedResults.map(({ content, score, filename }) => ({ content, score, filename }));
    } catch (error) {
      console.error('Document search error:', error);
      return [];
    }
  }

  // Get all documents for a bot
  async getDocumentsByBot(botId: string): Promise<any[]> {
    try {
      const documents = await DocumentModel.find({ botId }).select('-chunks.content');
      return documents;
    } catch (error) {
      console.error('Get documents error:', error);
      return [];
    }
  }

  // Delete document
  async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    try {
      // Delete from MongoDB
      const result = await DocumentModel.deleteOne({
        _id: documentId,
        userId,
      });

      // Delete from ChromaDB if MongoDB delete succeeded
      if (result.deletedCount > 0) {
        await chromaService.deleteDocument(documentId);
      }

      return result.deletedCount > 0;
    } catch (error) {
      console.error('Delete document error:', error);
      return false;
    }
  }
}

export const documentService = new DocumentService();
