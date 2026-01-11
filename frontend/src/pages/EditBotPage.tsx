import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import { DocumentManager } from '../components/DocumentManager';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

export const EditBotPage: React.FC = () => {
  const { botId } = useParams<{ botId: string }>();
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBot, setLoadingBot] = useState(true);
  
  const { api } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadBot = async () => {
      try {
        const response = await api.get(`/bots/${botId}`);
        const bot = response.data;
        setName(bot.name);
        setSystemPrompt(bot.systemPrompt);
        setVoiceId(bot.voiceId);
        setTemperature(bot.temperature);
      } catch (err: any) {
        setError('Failed to load bot');
      } finally {
        setLoadingBot(false);
      }
    };

    if (botId) {
      loadBot();
    }
  }, [botId, api]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.put(`/bots/${botId}`, {
        name,
        systemPrompt,
        voiceId,
        temperature,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update bot');
    } finally {
      setLoading(false);
    }
  };

  if (loadingBot) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Edit Voice Bot</CardTitle>
            <p className="text-gray-600 mt-2">Update your AI voice assistant configuration</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <Input
                label="Bot Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Customer Support Bot"
                required
              />

              <Textarea
                label="System Prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful customer support assistant..."
                rows={6}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voice Selection
                </label>
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <optgroup label="Custom Voices">
                    <option value="xz64BitkNKshbyFO2E4V">Varun</option>
                    <option value="CwhRBWXzGAHq8TQ4Fs17">Roger</option>
                    <option value="Bi1ie01Nk4hmVmCJ4qZh">Telangana Woman</option>
                  </optgroup>
                  <optgroup label="ElevenLabs Voices">
                    <option value="21m00Tcm4TlvDq8ikWAM">Rachel - Calm & Professional</option>
                    <option value="AZnzlk1XvdvUeBnXmlld">Domi - Strong & Confident</option>
                    <option value="EXAVITQu4vr4xnSDxMaL">Bella - Warm & Friendly</option>
                    <option value="ErXwobaYiN019PkySvjV">Antoni - Well-Rounded & Versatile</option>
                    <option value="MF3mGyEYCl7XYWbV9V6O">Elli - Young & Energetic</option>
                    <option value="TxGEqnHWrfWFTfGW9XjX">Josh - Deep & Authoritative</option>
                    <option value="VR6AewLTigWG4xSOukaG">Arnold - Crisp & Clear</option>
                    <option value="pNInz6obpgDQGcFmaJgB">Adam - Natural & Engaging</option>
                    <option value="yoZ06aMxZJJ28mfd3POQ">Sam - Dynamic & Expressive</option>
                  </optgroup>
                  <optgroup label="Browser TTS (Fallback)">
                    <option value="browser-default">Default Browser Voice</option>
                  </optgroup>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a voice personality for your AI assistant
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Controls randomness. Lower is more focused, higher is more creative.
                </p>
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Document Manager */}
        {botId && <DocumentManager botId={botId} />}
      </div>
    </div>
  );
};
