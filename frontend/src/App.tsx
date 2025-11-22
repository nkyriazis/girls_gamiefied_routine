import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ParentDashboard } from './components/ParentDashboard';
import { GameProvider } from './context/GameContext';

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/parent" element={<ParentDashboard />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
