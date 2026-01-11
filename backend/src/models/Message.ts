import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  timestamp: Date;
  metadata?: {
    duration?: number;
    model?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    audioUrl: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export const Message = mongoose.model<IMessage>('Message', messageSchema);
