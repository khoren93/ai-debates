import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DebateHistory from './pages/DebateHistory';
import CreateDebate from './pages/CreateDebate';
import DebateLive from './pages/DebateLive';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Routes>
        <Route path="/" element={<DebateHistory />} />
        <Route path="/create" element={<CreateDebate />} />
        <Route path="/debate/:id" element={<DebateLive />} />
      </Routes>
    </div>
  );
}

export default App;
