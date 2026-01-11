import mongoose, { Document, Schema } from 'mongoose';

export interface IVoiceBot extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  systemPrompt: string;
  voiceId: string;
  voiceModel?: string;
  llmModel?: string;
  temperature?: number;
  createdAt: Date;
  updatedAt: Date;
}

const voiceBotSchema = new Schema<IVoiceBot>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    systemPrompt: {
      type: String,
      required: true,
      default: 'You are a helpful voice assistant.',
    },
    voiceId: {
      type: String,
      required: true,
      default: 'default-voice',
    },
    voiceModel: {
      type: String,
      default: 'eleven_monolingual_v1',
    },
    llmModel: {
      type: String,
      default: 'gemini-2.5-flash',
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2,
    },
  },
  {
    timestamps: true,
  }
);

export const VoiceBot = mongoose.model<IVoiceBot>('VoiceBot', voiceBotSchema);
