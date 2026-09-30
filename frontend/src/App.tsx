import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { GameProvider } from './context/GameContext';
import { HelpProvider } from './help/HelpProvider';

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HelpProvider><Dashboard /></HelpProvider>} />
          <Route path="/parent" element={<ParentDashboard />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
