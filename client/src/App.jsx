import { useState } from 'react';
import axios from 'axios';
import { FaDownload, FaSpinner } from 'react-icons/fa';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('http://localhost:5000/generate', {
        prompt,
        ratio
      });
      setImages(response.data.images);
    } catch (error) {
      let message = 'Drawing failed 😢';
      
      if (error.response) {
        message = error.response.data.error || 
                 error.response.data.details || 
                 message;
      }
      
      setError(message);
      console.error("Full Error:", error);
    }
    setLoading(false);
  };

  const downloadImage = async (url, index) => {
    setDownloading(index);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download image');
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ai-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setError('Download failed: ' + error.message);
      console.error("Download Error:", error);
    }
    setDownloading(null);
  };

  return (
    <div className="app">
      <h1>AI Image Generator 🎨</h1>
      
      <div className="controls">
        <input
          type="text"
          placeholder="Describe your image..."
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setError(null);
          }}
          disabled={loading}
        />
        <select 
          value={ratio} 
          onChange={(e) => setRatio(e.target.value)}
          disabled={loading}
        >
          <option value="1:1">1:1</option>
          <option value="16:9">16:9</option>
        </select>
        <button 
          onClick={generateImage} 
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <>
              <FaSpinner className="spinner" /> Generating...
            </>
          ) : 'Generate'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="image-grid">
        {images.map((img, index) => (
          <div key={index} className="image-item">
            <div className="image-container">
              <img 
                src={img} 
                alt={`Generated ${index + 1}`} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/image-error.png';
                }}
              />
              <button 
                className="download-btn" 
                onClick={() => downloadImage(img, index)}
                disabled={downloading === index}
              >
                {downloading === index ? (
                  <FaSpinner className="spinner" />
                ) : (
                  <FaDownload />
                )}
                {downloading === index ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && !loading && !error && (
        <p className="placeholder-text">
          Your creations will appear here! 🖼️<br />
          Example prompts: "A cyberpunk cat", "Majestic mountain landscape at sunset"
        </p>
      )}
    </div>
    
  );
}

export default App;