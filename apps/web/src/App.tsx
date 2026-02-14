import { Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import RulesPage from './pages/RulesPage';
import WaitingRoomPage from './pages/WaitingRoomPage';
import GamePage from './pages/GamePage';

function App() {
  return (
    <div className="container">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/game/:code" element={<WaitingRoomPage />} />
        <Route path="/game/:code/play" element={<GamePage />} />
      </Routes>
    </div>
  );
}

export default App;
