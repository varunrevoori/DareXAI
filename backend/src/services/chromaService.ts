import { ChromaClient, Collection } from 'chromadb';

// Metadata interface compatible with ChromaDB's Metadata type
type EmbeddingMetadata = {
  documentId: string;
  chunkIndex: number;
  text: string;
  source: string;
  [key: string]: string | number | boolean;
};

class ChromaDBService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private collectionName = 'document_embeddings';
  private isAvailable = false;

  constructor() {
    // ChromaDB will be initialized on first use
  }

  /**
   * Initialize the ChromaDB collection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize ChromaDB client with configurable URL
      const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
      console.log(`🔮 Connecting to ChromaDB at ${chromaUrl}`);
      
      // Parse URL to extract host and port
      const url = new URL(chromaUrl);
      const port = url.port ? parseInt(url.port, 10) : 8000;
      
      this.client = new ChromaClient({
        host: url.hostname,
        port: port
      });
      
      // Get or create collection without embedding function (we provide embeddings)
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { 
          description: 'Document embeddings for RAG system',
        },
        // Don't use default embedding function - we provide embeddings
        embeddingFunction: undefined
      });
      
      this.isAvailable = true;
      console.log('✅ ChromaDB collection initialized:', this.collectionName);
    } catch (error: any) {
      console.error('❌ Failed to initialize ChromaDB:', error.message);
      console.warn('⚠️  ChromaDB not available - falling back to MongoDB-based search');
      this.isAvailable = false;
    }
  }

  /**
   * Check if ChromaDB is available
   */
  isConnected(): boolean {
    return this.isAvailable && this.collection !== null;
  }

  /**
   * Ensure collection is initialized
   */
  private async ensureCollection(): Promise<Collection | null> {
    if (!this.isAvailable) {
      return null;
    }
    
    if (!this.collection && this.isAvailable) {
      await this.initialize();
    }
    
    return this.collection;
  }

  /**
   * Add embeddings to ChromaDB with metadata
   */
  async addEmbeddings(
    documentId: string,
    chunks: string[],
    embeddings: number[][],
    source: string
  ): Promise<void> {
    const collection = await this.ensureCollection();
    
    if (!collection) {
      console.warn('⚠️  ChromaDB not available, skipping embedding storage');
      return;
    }

    // Generate unique IDs for each chunk
    const ids = chunks.map((_, index) => `${documentId}_chunk_${index}`);

    // Create metadata for each chunk (ensure all values are primitive types)
    const metadatas: EmbeddingMetadata[] = chunks.map((text, index) => ({
      documentId,
      chunkIndex: index,
      text,
      source
    }));

    try {
      // Add to ChromaDB
      await collection.add({
        ids,
        embeddings,
        metadatas: metadatas as any, // Type assertion for ChromaDB compatibility
        documents: chunks // Store text chunks for reference
      });

      console.log(`✅ Added ${chunks.length} embeddings to ChromaDB for document ${documentId}`);
    } catch (error: any) {
      console.error('❌ Failed to add embeddings to ChromaDB:', error.message);
      // Don't throw - allow system to continue without ChromaDB
    }
  }

  /**
   * Search for similar chunks using semantic search
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number = 8,
    filter?: { documentId?: string }
  ): Promise<Array<{
    id: string;
    text: string;
    score: number;
    metadata: EmbeddingMetadata;
  }>> {
    const collection = await this.ensureCollection();
    
    if (!collection) {
      console.warn('⚠️  ChromaDB not available, returning empty results');
      return [];
    }

    try {
      // Build where filter
      const where = filter?.documentId 
        ? { documentId: filter.documentId }
        : undefined;

      // Query ChromaDB
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: where as any,
        include: ['metadatas', 'documents', 'distances']
      });

      // Transform results
      const chunks = [];
      if (results.ids[0] && results.documents[0] && results.metadatas[0] && results.distances[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas[0][i] as any;
          chunks.push({
            id: results.ids[0][i],
            text: results.documents[0][i] as string,
            score: 1 - (results.distances[0][i] || 0), // Convert distance to similarity score
            metadata: {
              documentId: metadata.documentId || '',
              chunkIndex: metadata.chunkIndex || 0,
              text: metadata.text || '',
              source: metadata.source || ''
            }
          });
        }
      }

      console.log(`🔍 Found ${chunks.length} similar chunks (min score: ${chunks[chunks.length - 1]?.score.toFixed(3) || 'N/A'})`);
      return chunks;
    } catch (error: any) {
      console.error('❌ Failed to search ChromaDB:', error.message);
      return [];
    }
  }

  /**
   * Delete all embeddings for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const collection = await this.ensureCollection();
    
    if (!collection) {
      console.warn('⚠️  ChromaDB not available, skipping deletion');
      return;
    }

    try {
      // Delete by metadata filter
      await collection.delete({
        where: { documentId } as any
      });

      console.log(`🗑️ Deleted embeddings for document ${documentId}`);
    } catch (error: any) {
      console.error('❌ Failed to delete from ChromaDB:', error.message);
    }
  }

  /**
   * Get collection stats
   */
  async getStats(): Promise<{ count: number }> {
    const collection = await this.ensureCollection();
    
    if (!collection) {
      return { count: 0 };
    }

    try {
      const count = await collection.count();
      return { count };
    } catch (error: any) {
      console.error('❌ Failed to get ChromaDB stats:', error.message);
      return { count: 0 };
    }
  }

  /**
   * Clear all embeddings (use with caution!)
   */
  async clearAll(): Promise<void> {
    if (!this.client) {
      return;
    }
    
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = null;
      console.log('🗑️ Cleared all ChromaDB embeddings');
    } catch (error: any) {
      console.error('❌ Failed to clear ChromaDB:', error.message);
    }
  }
}

// Export singleton instance
export const chromaService = new ChromaDBService();
