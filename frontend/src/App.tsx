import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ParentDashboard } from './components/parent/ParentDashboard';
import { GameProvider } from './context/GameProvider';
import { HelpProvider } from './help/HelpProvider';
import { SoundProvider } from './sound/SoundProvider';

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SoundProvider><HelpProvider><Dashboard /></HelpProvider></SoundProvider>} />
          <Route path="/parent" element={<ParentDashboard />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
