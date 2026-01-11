import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Message, VoiceBot, Conversation } from '../types';

export const ConversationPage: React.FC = () => {
  const { botId } = useParams<{ botId: string }>();
  const [bot, setBot] = useState<VoiceBot | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { api } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBot();
    createConversation();
  }, [botId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadBot = async () => {
    try {
      const response = await api.get(`/bots/${botId}`);
      setBot(response.data.bot);
    } catch (error) {
      console.error('Failed to load bot:', error);
      setError('Failed to load bot');
    }
  };

  const createConversation = async () => {
    try {
      const response = await api.post('/conversations', { botId });
      setConversation(response.data.conversation);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Microphone access denied');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    if (!conversation) return;
    
    setIsProcessing(true);
    setError('');

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        // Send to backend
        const response = await api.post('/voice/process', {
          conversationId: conversation._id,
          audioBase64: base64Audio,
        });

        // Update messages
        const userMessage: Message = {
          _id: Date.now().toString() + '-user',
          conversationId: conversation._id,
          role: 'user',
          content: response.data.userText,
          timestamp: new Date(),
          createdAt: new Date(),
        };

        const assistantMessage: Message = {
          _id: Date.now().toString() + '-assistant',
          conversationId: conversation._id,
          role: 'assistant',
          content: response.data.assistantText,
          audioUrl: response.data.audioUrl,
          timestamp: new Date(),
          createdAt: new Date(),
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);

        // Play assistant response
        if (response.data.audioUrl && response.data.audioUrl.startsWith('data:audio')) {
          try {
            const audio = new Audio(response.data.audioUrl);
            setCurrentAudio(audio);
            setIsSpeaking(true);
            
            audio.onended = () => {
              setIsSpeaking(false);
              setCurrentAudio(null);
            };
            
            await audio.play();
          } catch (error) {
            console.log('Audio playback failed, using text-to-speech fallback');
            playTextToSpeech(response.data.assistantText);
          }
        } else {
          // Use browser's text-to-speech as fallback
          playTextToSpeech(response.data.assistantText);
        }
      };
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process voice');
      console.error('Process error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const playTextToSpeech = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      setCurrentUtterance(utterance);
      setIsSpeaking(true);
      
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentUtterance(null);
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    // Stop audio playback
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Stop speech synthesis
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    setIsSpeaking(false);
    setCurrentUtterance(null);
  };

  const endConversation = async () => {
    if (conversation) {
      try {
        await api.put(`/conversations/${conversation._id}/end`);
        navigate('/dashboard');
      } catch (error) {
        console.error('Failed to end conversation:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{bot?.name || 'Voice Chat'}</CardTitle>
                <p className="text-gray-600 text-sm mt-1">{bot?.systemPrompt}</p>
              </div>
              <Button variant="outline" onClick={endConversation}>
                End Chat
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card className="h-[500px] flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                Click the microphone to start conversation
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message._id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p>{message.content}</p>
                  <span className="text-xs opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="border-t p-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            
            <div className="flex justify-center gap-4">
              {isSpeaking && (
                <Button
                  size="lg"
                  onClick={stopSpeaking}
                  variant="secondary"
                  className="w-48"
                >
                  🛑 Stop Speaking
                </Button>
              )}
              
              <Button
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || isSpeaking}
                variant={isRecording ? 'danger' : 'primary'}
                className="w-48"
              >
                {isProcessing ? (
                  'Processing...'
                ) : isRecording ? (
                  '⏹ Stop Recording'
                ) : (
                  '🎤 Start Recording'
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
