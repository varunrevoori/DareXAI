import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { VoiceBot } from '../types';

export const DashboardPage: React.FC = () => {
  const [bots, setBots] = useState<VoiceBot[]>([]);
  const [loading, setLoading] = useState(true);
  const { api } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      const response = await api.get<{ bots: VoiceBot[] }>('/bots');
      setBots(response.data.bots);
    } catch (error) {
      console.error('Failed to load bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this bot?')) return;
    
    try {
      await api.delete(`/bots/${id}`);
      setBots(bots.filter(bot => bot._id !== id));
    } catch (error) {
      console.error('Failed to delete bot:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Voice Bots</h1>
            <p className="text-gray-600 mt-1">Manage and create your AI voice assistants</p>
          </div>
          <Button onClick={() => navigate('/bots/create')}>
            + Create New Bot
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading bots...</p>
          </div>
        ) : bots.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No voice bots yet</h3>
              <p className="text-gray-600 mb-4">Create your first voice bot to get started</p>
              <Button onClick={() => navigate('/bots/create')}>
                Create Your First Bot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <Card key={bot._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{bot.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {bot.systemPrompt}
                  </p>
                  <div className="flex flex-col space-y-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/bots/${bot._id}/conversation`)}
                      className="w-full"
                    >
                      Start Chat
                    </Button>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/bots/${bot._id}/documents`)}
                        className="flex-1"
                        title="Manage Documents"
                      >
                        📄 Docs
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/bots/${bot._id}/edit`)}
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteBot(bot._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
