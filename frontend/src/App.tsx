import { Routes, Route, Link, useParams } from 'react-router-dom';
import DebateHistory from './pages/DebateHistory';
import CreateDebate from './pages/CreateDebate';
import DebateLive from './pages/DebateLive';

const NotFound = () => (
  <div className="max-w-7xl mx-auto p-10 text-center">
    <h1 className="text-3xl font-bold mb-2">Page not found</h1>
    <p className="text-gray-500 mb-6">The page you are looking for does not exist.</p>
    <Link to="/" className="text-blue-600 hover:underline">Back to home</Link>
  </div>
);

// Keyed by id so navigating between debates resets the page state.
const DebateLiveRoute = () => {
  const { id } = useParams<{ id: string }>();
  return <DebateLive key={id} />;
};

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Routes>
        <Route path="/" element={<DebateHistory />} />
        <Route path="/create" element={<CreateDebate />} />
        <Route path="/debate/:id" element={<DebateLiveRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
