import mongoose, { Document, Schema } from 'mongoose';

export interface IDocumentChunk {
  content: string;
  pageNumber?: number;
  chunkIndex: number;
}

export interface IDocument extends Document {
  botId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  source: string; // 'pdf' | 'url'
  chunks: IDocumentChunk[];
  totalChunks: number;
  processed: boolean;
}

const documentChunkSchema = new Schema({
  content: { type: String, required: true },
  pageNumber: { type: Number },
  chunkIndex: { type: Number, required: true },
});

const documentSchema = new Schema<IDocument>({
  botId: {
    type: Schema.Types.ObjectId,
    ref: 'VoiceBot',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
    enum: ['pdf', 'txt', 'doc', 'docx'],
  },
  fileSize: {
    type: Number,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  source: {
    type: String,
    required: true,
    enum: ['pdf', 'url'],
  },
  chunks: [documentChunkSchema],
  totalChunks: {
    type: Number,
    default: 0,
  },
  processed: {
    type: Boolean,
    default: false,
  },
});

// Index for text search on chunks
documentSchema.index({ 'chunks.content': 'text' });
documentSchema.index({ botId: 1, processed: 1 });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
