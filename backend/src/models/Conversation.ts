import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  botId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
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
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
