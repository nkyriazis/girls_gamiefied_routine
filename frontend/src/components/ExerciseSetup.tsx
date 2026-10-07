import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartIcon } from './SmartIcon';
import { api, ApiError } from '../api';
import type { ExerciseCategoryDef, User } from '@shared/types';
import { help } from '../help/anchors';
import { HelpScreen } from '../help/HelpProvider';
import { gameSetupTour } from './ExerciseSetup.help';
import { sfx, sound } from '../sound/sfx';

interface ExerciseSetupProps {
  users: User[];
  onClose: () => void;
  // Resolves once the game has started; rejects with the server's refusal (the setup then says why)
  onStart: (playerIds: string[], categories: string[], totalRounds: number, questionsPerRound: number) => Promise<void>;
}

export const ExerciseSetup: React.FC<ExerciseSetupProps> = ({ users, onClose, onStart }) => {
  const [categories, setCategories] = useState<ExerciseCategoryDef[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // array of category IDs
  const [totalRounds, setTotalRounds] = useState(3);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await api.getExerciseCategories();
        setCategories(cats);
        // Initially select all categories
        setSelectedCategories(cats.map(c => c.id));
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedPlayers(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  // The start button is disabled until a kid and a category are chosen. A start the server
  // refuses keeps the setup open and says why, in place (never a browser alert()).
  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setRefusal(null);
    try {
      await onStart(selectedPlayers, selectedCategories, totalRounds, questionsPerRound);
    } catch (err) {
      console.error('Could not start the game:', err);
      sfx('nope');
      setRefusal(err instanceof ApiError && err.message === 'No exercises found for these categories'
        ? 'Δεν βρέθηκαν ασκήσεις για αυτά τα παιδιά και τις κατηγορίες. Διάλεξε άλλες κατηγορίες.'
        : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.');
      setStarting(false);
    }
  };

  return (
    <HelpScreen tour={gameSetupTour()}>
    <motion.div
      className="setup-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="setup-card"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="setup-header">
          <h2>Προετοιμασία Παιχνιδιού</h2>
          <button className="close-btn-circle" {...sound('close')} onClick={onClose}>✕</button>
        </div>

        <div className="setup-content">
          {/* Players Selection */}
          <section className="setup-section">
            <h3>Ποια παιδιά θα παίξουν;</h3>
            <div className="players-grid" {...help('game.players')}>
              {users.map(user => (
                <motion.div
                  key={user.id}
                  className={`player-select-item ${selectedPlayers.includes(user.id) ? 'selected' : ''}`}
                  {...sound(selectedPlayers.includes(user.id) ? 'unselect' : 'select')}
                  onClick={() => togglePlayer(user.id)}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="player-avatar">
                    <SmartIcon value={user.avatar || '👧'} />
                  </div>
                  <span>{user.name}</span>
                  {selectedPlayers.includes(user.id) && <div className="check-badge">✓</div>}
                </motion.div>
              ))}
            </div>
          </section>

          {/* Categories Selection */}
          <section className="setup-section">
            <h3>Κατηγορίες</h3>
            {isLoading ? (
              <div className="loading-spinner">Φόρτωση...</div>
            ) : (
              <div className="categories-chips" {...help('game.subjects')}>
                {categories.map(({ id: catId, label: catLabel, icon: catIcon }) => {
                  return (
                    <motion.button
                      key={catId}
                      className={`category-chip ${selectedCategories.includes(catId) ? 'selected' : ''}`}
                      {...sound(selectedCategories.includes(catId) ? 'unselect' : 'select')}
                      onClick={() => toggleCategory(catId)}
                      whileTap={{ scale: 0.95 }}
                    >
                      {catIcon && <SmartIcon value={catIcon} className="cat-icon" />}
                      <span>{catLabel}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Settings Selection */}
          <section className="setup-section settings-row" {...help('game.length')}>
            <div className="setting-item">
              <label>Γύροι (1-5)</label>
              <div className="counter-controls">
                <button {...sound('unselect')} onClick={() => setTotalRounds(Math.max(1, totalRounds - 1))}>-</button>
                <span>{totalRounds}</span>
                <button {...sound('select')} onClick={() => setTotalRounds(Math.min(5, totalRounds + 1))}>+</button>
              </div>
            </div>
            <div className="setting-item">
              <label>Ερωτήσεις ανά γύρο (1-10)</label>
              <div className="counter-controls">
                <button {...sound('unselect')} onClick={() => setQuestionsPerRound(Math.max(1, questionsPerRound - 1))}>-</button>
                <span>{questionsPerRound}</span>
                <button {...sound('select')} onClick={() => setQuestionsPerRound(Math.min(10, questionsPerRound + 1))}>+</button>
              </div>
            </div>
          </section>
        </div>

        <AnimatePresence>
          {refusal && (
            <motion.div className="setup-refusal" role="alert"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }}>
              {refusal}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="setup-actions">
          <motion.button
            className="start-game-btn"
            {...sound('open')}
            {...help('game.start')}
            onClick={handleStart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={selectedPlayers.length === 0 || selectedCategories.length === 0 || starting}
          >
            {starting ? 'Ξεκινάει…' : '🎮 Έναρξη Παιχνιδιού'}
          </motion.button>
        </div>
      </motion.div>

      <style>{`
        .setup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          z-index: var(--z-modal);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .setup-card {
          background: linear-gradient(135deg, #2a2a4a 0%, #1a1a3a 100%);
          width: 100%;
          max-width: 600px;
          border-radius: 2.5rem;
          padding: 2.5rem;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
          position: relative;
        }

        .setup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .setup-header h2 {
          margin: 0;
          font-size: 1.8rem;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .close-btn-circle {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          transition: all 0.2s;
        }

        .close-btn-circle:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }

        .setup-content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .setup-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          opacity: 0.8;
          color: #a0a0c0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .players-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 1rem;
        }

        .player-select-item {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          border: 2px solid transparent;
        }

        .player-select-item.selected {
          background: rgba(255, 215, 0, 0.1);
          border-color: gold;
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(255, 215, 0, 0.1);
        }

        .player-avatar {
          font-size: 2.5rem;
        }

        .check-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: gold;
          color: #1a1a3a;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.8rem;
          border: 2px solid #1a1a3a;
        }

        .categories-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .category-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.6rem 1.2rem;
          border-radius: 2rem;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .category-chip .cat-icon {
          font-size: 1.2rem;
        }

        .category-chip.selected {
          background: gold;
          color: #1a1a3a;
          border-color: gold;
          font-weight: 600;
        }

        .settings-row {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .setting-item {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .setting-item label {
          font-size: 0.9rem;
          color: #a0a0c0;
        }

        .counter-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.5rem;
          border-radius: 1rem;
          width: fit-content;
        }

        .counter-controls button {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .counter-controls button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .counter-controls span {
          font-size: 1.2rem;
          font-weight: bold;
          min-width: 30px;
          text-align: center;
        }

        .setup-refusal {
          margin-top: 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          text-align: center;
          color: #ff6b6b;
          background: rgba(255,107,107,0.12);
          padding: 0.6rem 1rem;
          border-radius: 0.75rem;
        }

        .setup-actions {
          margin-top: 3rem;
          display: flex;
          justify-content: center;
        }

        .start-game-btn {
          background: linear-gradient(to right, #ffcc33, #ffb300);
          border: none;
          color: #1a1a3a;
          padding: 1.2rem 3rem;
          border-radius: 2rem;
          font-size: 1.3rem;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(255, 204, 51, 0.3);
          transition: all 0.3s;
        }

        .start-game-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .start-game-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(255, 204, 51, 0.4);
        }
      `}</style>
    </motion.div>
    </HelpScreen>
  );
};
