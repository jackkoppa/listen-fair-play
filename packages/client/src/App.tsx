import { Routes, Route, Navigate } from 'react-router'
import HomePage from './routes/HomePage'
import EpisodeRoute from './routes/EpisodeRoute'

/**
 * Main App component that sets up routing configuration.
 * 
 * Routes:
 * - `/` - Home page with search functionality
 * - `/episode/:eID` - Same home page + EpisodeDetailsSheet overlay
 * - `/episode` (without eID) - Redirects to `/` (invalid route)
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />}>
        {/* Child route for episode sheet overlay */}
        <Route path="episode/:eID" element={<EpisodeRoute />} />
      </Route>
      {/* Redirect invalid episode route to home */}
      <Route path="/episode" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
