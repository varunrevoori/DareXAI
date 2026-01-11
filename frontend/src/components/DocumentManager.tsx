import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface Document {
  _id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  totalChunks: number;
  processed: boolean;
}

interface DocumentManagerProps {
  botId: string;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ botId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [urlInput, setUrlInput] = useState<string>('');
  const { api } = useAuth();

  const loadDocuments = async () => {
    try {
      const response = await api.get(`/bots/${botId}/documents`);
      setDocuments(response.data.documents);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    if (botId) {
      loadDocuments();
    }
  }, [botId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(`/bots/${botId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Document uploaded and processed successfully!');
      await loadDocuments();
      
      // Clear file input
      e.target.value = '';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      await api.post(`/bots/${botId}/documents`, {
        url: urlInput,
      });

      setSuccess('URL content extracted and processed successfully!');
      setUrlInput('');
      await loadDocuments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process URL');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/documents/${documentId}`);
      setSuccess('Document deleted successfully');
      await loadDocuments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Knowledge Base Documents</CardTitle>
        <p className="text-gray-600 text-sm mt-2">
          Upload PDF documents to enhance your bot's responses with custom knowledge using RAG (Retrieval Augmented Generation).
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="mb-6 space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF File
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100
                disabled:opacity-50"
            />
          </div>

          {/* URL Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Add Web Page URL
            </label>
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                disabled={uploading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
              >
                Add URL
              </button>
            </form>
          </div>

          {uploading && (
            <p className="text-sm text-gray-600">
              Processing... This may take a minute.
            </p>
          )}
          <p className="text-sm text-gray-500">
            Upload PDF files (max 10MB) or provide URLs to web pages. Content will be used to enhance bot responses.
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2">No documents uploaded yet</p>
            <p className="text-sm">Upload a PDF to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{doc.filename}</h4>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>•</span>
                    <span>{doc.totalChunks} chunks</span>
                    <span>•</span>
                    <span>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                    {doc.processed && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 font-medium">
                          ✓ Processed
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(doc._id)}
                  className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
