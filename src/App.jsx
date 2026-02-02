import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import cardDataRaw from './data/bookerCards.json';

// Extract all cards from the nested sets structure
const getCardDataArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.cards)) return data.cards;
  
  // Handle nested sets structure: { sets: { "set-name": { name: "...", cards: [...] } } }
  if (data.sets && typeof data.sets === 'object') {
    const allCards = [];
    Object.entries(data.sets).forEach(([setKey, set]) => {
      if (set && Array.isArray(set.cards)) {
        set.cards.forEach(card => {
          // Use the parent set's name as the setName for grouping
          // Create cardName from the card's setName + parallel for display
          allCards.push({
            ...card,
            setName: set.name || card.setName || setKey,
            cardName: card.cardName || card.parallel || card.setName || 'Card',
          });
        });
      }
    });
    return allCards;
  }
  
  return [];
};
const cardData = getCardDataArray(cardDataRaw);

// Helper to ensure arrays
const ensureArray = (val) => Array.isArray(val) ? val : [];

// Get rarity color based on serial number
const getRarityColor = (serial) => {
  if (!serial) return 'bg-slate-500';
  if (serial === '/1' || serial === '1/1') return 'bg-red-500';
  if (serial.includes('/5')) return 'bg-red-400';
  if (serial.includes('/10')) return 'bg-orange-500';
  if (serial.includes('/25')) return 'bg-orange-400';
  if (serial.includes('/50')) return 'bg-amber-500';
  if (serial.includes('/75')) return 'bg-purple-500';
  if (serial.includes('/99')) return 'bg-green-500';
  if (serial.includes('/150') || serial.includes('/199')) return 'bg-blue-500';
  return 'bg-slate-500';
};

// Get rarity text color
const getRarityTextColor = (serial) => {
  if (!serial) return 'text-slate-400';
  if (serial === '/1' || serial === '1/1') return 'text-red-400';
  if (serial.includes('/5')) return 'text-red-300';
  if (serial.includes('/10')) return 'text-orange-400';
  if (serial.includes('/25')) return 'text-orange-300';
  if (serial.includes('/50')) return 'text-amber-400';
  if (serial.includes('/75')) return 'text-purple-400';
  if (serial.includes('/99')) return 'text-green-400';
  if (serial.includes('/150') || serial.includes('/199')) return 'text-blue-400';
  return 'text-slate-400';
};

// Sort cards: base first, then by serial (highest to lowest, 1/1 last)
const sortCardsByRarity = (cards) => {
  return [...cards].sort((a, b) => {
    if (!a.serial && b.serial) return -1;
    if (a.serial && !b.serial) return 1;
    if (!a.serial && !b.serial) return 0;
    const getSerialNum = (s) => {
      if (s === '1/1') return 1;
      const m = s.match(/\/(\d+)/);
      return m ? parseInt(m[1]) : 999;
    };
    return getSerialNum(b.serial) - getSerialNum(a.serial);
  });
};

// Swipeable Card Item Component
const SwipeableCard = ({ card, collected, rarityColor, onDelete, onToggle, onTap, onDragStart, onDragOver, onDragEnd, isDragging }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (diff < 0) setSwipeX(Math.max(diff, -100));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < -60) {
      setIsDeleting(true);
      setTimeout(() => onDelete(card), 200);
    } else {
      setSwipeX(0);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) return;
    startXRef.current = e.clientX;
    setIsSwiping(true);
  };

  const handleMouseMove = (e) => {
    if (!isSwiping) return;
    const diff = e.clientX - startXRef.current;
    if (diff < 0) setSwipeX(Math.max(diff, -100));
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSwiping) {
        setIsSwiping(false);
        if (swipeX < -60) {
          setIsDeleting(true);
          setTimeout(() => onDelete(card), 200);
        } else {
          setSwipeX(0);
        }
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSwiping, swipeX, onDelete, card]);

  if (isDeleting) {
    return <div className="h-0 overflow-hidden transition-all duration-200 ease-out" />;
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-xl mb-2 ${isDragging ? 'opacity-50' : ''}`} 
      ref={containerRef}
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onDragOver={(e) => onDragOver(e, card)}
      onDragEnd={onDragEnd}
    >
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-end pr-4 rounded-xl">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
      
      {/* Swipeable content */}
      <div 
        className={`relative flex items-center gap-3 p-3 border transition-transform ${collected ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/90 border-slate-700'} rounded-xl cursor-pointer`}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={(e) => {
          if (Math.abs(swipeX) < 5 && !e.target.closest('.drag-handle') && !e.target.closest('.checkbox-area')) {
            onTap(card);
          }
        }}
      >
        {/* Drag handle */}
        <div className="drag-handle cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 touch-none">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        </div>

        {/* Color bar */}
        <div className={`w-1.5 h-14 rounded-full ${collected ? rarityColor : 'bg-slate-600'} ${collected ? 'shadow-lg' : ''}`} />
        
        {/* Card info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium truncate ${collected ? 'text-white' : 'text-slate-300'}`}>
              {card.cardName}
            </span>
            {card.serial && (
              <span className={`text-xs font-bold ${collected ? getRarityTextColor(card.serial) : 'text-slate-500'}`}>
                {card.serial}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 truncate">
            #{card.cardNumber} • {card.parallel || 'Base'}
          </div>
          {card.source && (
            <div className="text-xs text-slate-500 truncate">{card.source}</div>
          )}
        </div>

        {/* Checkbox */}
        <div 
          className="checkbox-area p-2"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(card);
          }}
        >
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${collected ? 'bg-green-500 border-green-500' : 'border-slate-500'}`}>
            {collected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Swipeable Collection Header Component
const SwipeableCollectionHeader = ({ setName, cardCount, collectedCount, isExpanded, onToggleExpand, onDelete, onEdit }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (diff < 0) setSwipeX(Math.max(diff, -100));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < -60) {
      setIsDeleting(true);
      setTimeout(() => onDelete(setName), 200);
    } else {
      setSwipeX(0);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.edit-btn')) return;
    startXRef.current = e.clientX;
    setIsSwiping(true);
  };

  const handleMouseMove = (e) => {
    if (!isSwiping) return;
    const diff = e.clientX - startXRef.current;
    if (diff < 0) setSwipeX(Math.max(diff, -100));
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSwiping) {
        setIsSwiping(false);
        if (swipeX < -60) {
          setIsDeleting(true);
          setTimeout(() => onDelete(setName), 200);
        } else {
          setSwipeX(0);
        }
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSwiping, swipeX, onDelete, setName]);

  if (isDeleting) {
    return <div className="h-0 overflow-hidden transition-all duration-200 ease-out" />;
  }

  const percentage = cardCount > 0 ? Math.round((collectedCount / cardCount) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl mb-2">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-end pr-4 rounded-xl">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>

      {/* Swipeable content */}
      <div 
        className="relative bg-gradient-to-r from-slate-700 to-slate-800 p-4 rounded-xl cursor-pointer"
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={(e) => {
          if (Math.abs(swipeX) < 5 && !e.target.closest('.edit-btn')) {
            onToggleExpand();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div>
              <h3 className="font-semibold text-white">{setName}</h3>
              <p className="text-xs text-slate-400">{collectedCount}/{cardCount} cards • {percentage}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Edit button */}
            <button
              className="edit-btn p-2 text-slate-400 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(setName);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {/* Progress ring */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90">
                <circle cx="20" cy="20" r="16" stroke="#334155" strokeWidth="3" fill="none" />
                <circle 
                  cx="20" cy="20" r="16" 
                  stroke={percentage === 100 ? '#22c55e' : '#f97316'} 
                  strokeWidth="3" 
                  fill="none" 
                  strokeDasharray={`${percentage} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {percentage}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Card Detail Modal with Edit capability
const CardDetailModal = ({ card, isOpen, onClose, onSave, collected, onToggle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCard, setEditedCard] = useState({ ...card });

  useEffect(() => {
    setEditedCard({ ...card });
    setIsEditing(false);
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSave = () => {
    onSave(editedCard);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Card Details</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Set Name</label>
                <input
                  type="text"
                  value={editedCard.setName || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, setName: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Card Name</label>
                <input
                  type="text"
                  value={editedCard.cardName || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, cardName: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Card Number</label>
                <input
                  type="text"
                  value={editedCard.cardNumber || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, cardNumber: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Parallel</label>
                <input
                  type="text"
                  value={editedCard.parallel || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, parallel: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Serial #</label>
                <input
                  type="text"
                  value={editedCard.serial || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, serial: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                  placeholder="/99, /25, 1/1..."
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Source</label>
                <input
                  type="text"
                  value={editedCard.source || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, source: e.target.value })}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                  placeholder="Hobby, Retail, etc."
                />
              </div>
              <button
                onClick={handleSave}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-16 rounded-full ${collected ? getRarityColor(card.serial) : 'bg-slate-600'}`} />
                <div>
                  <p className="text-white font-semibold text-lg">{card.cardName}</p>
                  <p className="text-slate-400">#{card.cardNumber}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Set</p>
                  <p className="text-white font-medium">{card.setName}</p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Parallel</p>
                  <p className="text-white font-medium">{card.parallel || 'Base'}</p>
                </div>
                {card.serial && (
                  <div className="bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-xs text-slate-400">Serial</p>
                    <p className={`font-bold ${getRarityTextColor(card.serial)}`}>{card.serial}</p>
                  </div>
                )}
                {card.source && (
                  <div className="bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-xs text-slate-400">Source</p>
                    <p className="text-white font-medium">{card.source}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => onToggle(card)}
                className={`w-full py-3 rounded-xl font-semibold transition-colors ${collected ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                {collected ? 'Mark as Not Collected' : 'Mark as Collected'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Edit Collection Modal
const EditCollectionModal = ({ isOpen, onClose, collectionName, onSave }) => {
  const [newName, setNewName] = useState(collectionName);

  useEffect(() => {
    setNewName(collectionName);
  }, [collectionName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Edit Collection</h3>
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">Collection Name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (newName.trim() && newName !== collectionName) {
                onSave(collectionName, newName.trim());
              }
              onClose();
            }}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Create Collection Modal (empty collection)
const CreateCollectionModal = ({ isOpen, onClose, onSave, existingCollections }) => {
  const safeExisting = Array.isArray(existingCollections) ? existingCollections : [];
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a collection name');
      return;
    }
    if (safeExisting.includes(name.trim())) {
      setError('Collection already exists');
      return;
    }
    onSave(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Create Collection</h3>
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">Collection Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="e.g., Midnight, Sapphire..."
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

// Bulk Add Cards Modal
const BulkAddCardsModal = ({ isOpen, onClose, onSave, collections }) => {
  const safeCollections = Array.isArray(collections) ? collections : [];
  const [selectedCollection, setSelectedCollection] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isNewCollection, setIsNewCollection] = useState(false);
  const [cards, setCards] = useState([{ cardName: '', cardNumber: '', parallel: '', serial: '', source: '' }]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedCollection(safeCollections[0] || '');
      setNewCollectionName('');
      setIsNewCollection(false);
      setCards([{ cardName: '', cardNumber: '', parallel: '', serial: '', source: '' }]);
      setError('');
    }
  }, [isOpen, safeCollections]);

  if (!isOpen) return null;

  const addAnotherCard = () => {
    setCards([...cards, { cardName: '', cardNumber: '', parallel: '', serial: '', source: '' }]);
  };

  const updateCard = (index, field, value) => {
    const newCards = [...cards];
    newCards[index][field] = value;
    setCards(newCards);
  };

  const removeCard = (index) => {
    if (cards.length > 1) {
      setCards(cards.filter((_, i) => i !== index));
    }
  };

  const duplicateCard = (index) => {
    const cardToDupe = { ...cards[index] };
    const newCards = [...cards];
    newCards.splice(index + 1, 0, cardToDupe);
    setCards(newCards);
  };

  const handleSave = () => {
    const collectionName = isNewCollection ? newCollectionName.trim() : selectedCollection;
    
    if (!collectionName) {
      setError('Please select or create a collection');
      return;
    }

    // Filter out empty cards
    const validCards = cards.filter(c => c.cardName.trim() || c.cardNumber.trim());
    
    if (validCards.length === 0) {
      setError('Please add at least one card');
      return;
    }

    // Add collection name to each card
    const cardsWithCollection = validCards.map(c => ({
      ...c,
      setName: collectionName,
      cardName: c.cardName.trim(),
      cardNumber: c.cardNumber.trim(),
      parallel: c.parallel.trim(),
      serial: c.serial.trim(),
      source: c.source.trim(),
    }));

    onSave(cardsWithCollection, collectionName);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Add Cards</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Collection Selection */}
        <div className="mb-4 p-3 bg-slate-700/50 rounded-xl">
          <label className="text-sm text-slate-300 block mb-2">Collection</label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setIsNewCollection(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isNewCollection ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-300'}`}
            >
              Existing
            </button>
            <button
              onClick={() => setIsNewCollection(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isNewCollection ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-300'}`}
            >
              New
            </button>
          </div>
          {isNewCollection ? (
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="New collection name..."
              className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
            />
          ) : (
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
            >
              {safeCollections.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Cards List */}
        <div className="space-y-3 mb-4">
          {cards.map((card, index) => (
            <div key={index} className="bg-slate-700/50 p-3 rounded-xl relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Card {index + 1}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => duplicateCard(index)}
                    className="p-1 text-slate-400 hover:text-orange-400 transition-colors"
                    title="Duplicate"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {cards.length > 1 && (
                    <button
                      onClick={() => removeCard(index)}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={card.cardName}
                  onChange={(e) => updateCard(index, 'cardName', e.target.value)}
                  placeholder="Card Name"
                  className="bg-slate-700 text-white px-2 py-1.5 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={card.cardNumber}
                  onChange={(e) => updateCard(index, 'cardNumber', e.target.value)}
                  placeholder="Card #"
                  className="bg-slate-700 text-white px-2 py-1.5 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={card.parallel}
                  onChange={(e) => updateCard(index, 'parallel', e.target.value)}
                  placeholder="Parallel"
                  className="bg-slate-700 text-white px-2 py-1.5 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={card.serial}
                  onChange={(e) => updateCard(index, 'serial', e.target.value)}
                  placeholder="Serial (/99, /25...)"
                  className="bg-slate-700 text-white px-2 py-1.5 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                />
                <input
                  type="text"
                  value={card.source}
                  onChange={(e) => updateCard(index, 'source', e.target.value)}
                  placeholder="Source"
                  className="col-span-2 bg-slate-700 text-white px-2 py-1.5 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Another Card Button */}
        <button
          onClick={addAnotherCard}
          className="w-full py-3 mb-4 border-2 border-dashed border-slate-600 text-slate-400 hover:text-orange-400 hover:border-orange-400 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Another Card
        </button>

        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

        {/* Summary & Save */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Save {cards.filter(c => c.cardName.trim() || c.cardNumber.trim()).length} Card{cards.filter(c => c.cardName.trim() || c.cardNumber.trim()).length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// Filter/Sort Modal
const FilterSortModal = ({ isOpen, onClose, sortBy, setSortBy, filterCollected, setFilterCollected }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-4">Filter & Sort</h3>
        
        <div className="mb-4">
          <p className="text-sm text-slate-400 mb-2">Sort by</p>
          <div className="grid grid-cols-2 gap-2">
            {['Custom Order', 'Rarity', 'Card Number', 'Name'].map((option) => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${sortBy === option ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-slate-400 mb-2">Show</p>
          <div className="grid grid-cols-3 gap-2">
            {['All', 'Collected', 'Need'].map((option) => (
              <button
                key={option}
                onClick={() => setFilterCollected(option)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${filterCollected === option ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collectedCards, setCollectedCards] = useState({});
  const [customCards, setCustomCards] = useState([]);
  const [hiddenCards, setHiddenCards] = useState([]);
  const [hiddenSets, setHiddenSets] = useState([]);
  const [emptyCollections, setEmptyCollections] = useState([]);
  const [cardOrder, setCardOrder] = useState({});
  const [expandedSets, setExpandedSets] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Custom Order');
  const [filterCollected, setFilterCollected] = useState('All');
  
  // Modal states
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  
  // Drag state
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedSetName, setDraggedSetName] = useState(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCollectedCards(data.collectedCards || {});
          setCustomCards(ensureArray(data.customCards));
          setHiddenCards(ensureArray(data.hiddenCards));
          setHiddenSets(ensureArray(data.hiddenSets));
          setEmptyCollections(ensureArray(data.emptyCollections));
          setCardOrder(data.cardOrder || {});
        }
      } else {
        setCollectedCards({});
        setCustomCards([]);
        setHiddenCards([]);
        setHiddenSets([]);
        setEmptyCollections([]);
        setCardOrder({});
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Save to Firebase
  const saveToFirebase = async (updates) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, {
      collectedCards,
      customCards,
      hiddenCards,
      hiddenSets,
      emptyCollections,
      cardOrder,
      ...updates,
    }, { merge: true });
  };

  // Generate unique card ID
  const getCardId = (card) => `${card.setName}-${card.cardNumber}-${card.parallel || 'base'}-${card.serial || ''}`;

  // Combine base cards with custom cards
  const allCards = useMemo(() => {
    const baseCardsArray = ensureArray(cardData);
    const hiddenCardsArray = ensureArray(hiddenCards);
    const hiddenSetsArray = ensureArray(hiddenSets);
    const customCardsArray = ensureArray(customCards);
    
    const baseCards = baseCardsArray.filter(card => {
      if (!card) return false;
      const id = getCardId(card);
      return !hiddenCardsArray.includes(id) && !hiddenSetsArray.includes(card.setName);
    });
    return [...baseCards, ...customCardsArray];
  }, [customCards, hiddenCards, hiddenSets]);

  // Get all collection names (including empty ones)
  const allCollections = useMemo(() => {
    const cardsArray = ensureArray(allCards);
    const emptyArray = ensureArray(emptyCollections);
    const fromCards = [...new Set(cardsArray.map(c => c.setName).filter(Boolean))];
    const combined = [...new Set([...fromCards, ...emptyArray])];
    return combined.sort();
  }, [allCards, emptyCollections]);

  // Group cards by set
  const cardsBySet = useMemo(() => {
    const grouped = {};
    const emptyArray = ensureArray(emptyCollections);
    const cardsArray = ensureArray(allCards);
    
    // Initialize empty collections
    emptyArray.forEach(name => {
      if (name && !grouped[name]) grouped[name] = [];
    });
    
    // Group cards
    cardsArray.forEach(card => {
      if (!card || !card.setName) return;
      if (!grouped[card.setName]) grouped[card.setName] = [];
      grouped[card.setName].push(card);
    });

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      Object.keys(grouped).forEach(setName => {
        grouped[setName] = grouped[setName].filter(card =>
          card.cardName.toLowerCase().includes(query) ||
          card.cardNumber.toLowerCase().includes(query) ||
          (card.parallel && card.parallel.toLowerCase().includes(query))
        );
      });
    }

    // Apply collected filter
    Object.keys(grouped).forEach(setName => {
      if (filterCollected === 'Collected') {
        grouped[setName] = grouped[setName].filter(card => collectedCards[getCardId(card)]);
      } else if (filterCollected === 'Need') {
        grouped[setName] = grouped[setName].filter(card => !collectedCards[getCardId(card)]);
      }
    });

    // Apply sort
    Object.keys(grouped).forEach(setName => {
      const order = cardOrder[setName] || [];
      
      if (sortBy === 'Custom Order' && order.length > 0) {
        grouped[setName].sort((a, b) => {
          const aIdx = order.indexOf(getCardId(a));
          const bIdx = order.indexOf(getCardId(b));
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      } else if (sortBy === 'Rarity') {
        grouped[setName] = sortCardsByRarity(grouped[setName]);
      } else if (sortBy === 'Card Number') {
        grouped[setName].sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, undefined, { numeric: true }));
      } else if (sortBy === 'Name') {
        grouped[setName].sort((a, b) => a.cardName.localeCompare(b.cardName));
      }
    });

    return grouped;
  }, [allCards, searchQuery, sortBy, filterCollected, collectedCards, cardOrder, emptyCollections]);

  // Toggle card collection
  const toggleCard = (card) => {
    const id = getCardId(card);
    const newCollected = { ...collectedCards, [id]: !collectedCards[id] };
    if (!newCollected[id]) delete newCollected[id];
    setCollectedCards(newCollected);
    saveToFirebase({ collectedCards: newCollected });
  };

  // Delete card (hide base cards, delete custom cards)
  const deleteCard = (card) => {
    const id = getCardId(card);
    const isCustom = customCards.some(c => getCardId(c) === id);
    
    if (isCustom) {
      const newCustom = customCards.filter(c => getCardId(c) !== id);
      setCustomCards(newCustom);
      saveToFirebase({ customCards: newCustom });
    } else {
      const newHidden = [...hiddenCards, id];
      setHiddenCards(newHidden);
      saveToFirebase({ hiddenCards: newHidden });
    }
  };

  // Delete entire collection
  const deleteCollection = (setName) => {
    // Hide the set if it has base cards
    const hasBaseCards = cardData.some(c => c.setName === setName);
    if (hasBaseCards) {
      const newHiddenSets = [...hiddenSets, setName];
      setHiddenSets(newHiddenSets);
      saveToFirebase({ hiddenSets: newHiddenSets });
    }
    
    // Remove custom cards in this set
    const newCustom = customCards.filter(c => c.setName !== setName);
    setCustomCards(newCustom);
    
    // Remove from empty collections
    const newEmpty = emptyCollections.filter(c => c !== setName);
    setEmptyCollections(newEmpty);
    
    saveToFirebase({ customCards: newCustom, emptyCollections: newEmpty });
  };

  // Rename collection
  const renameCollection = (oldName, newName) => {
    // Update custom cards
    const newCustom = customCards.map(c => 
      c.setName === oldName ? { ...c, setName: newName } : c
    );
    setCustomCards(newCustom);

    // Update empty collections
    const newEmpty = emptyCollections.map(c => c === oldName ? newName : c);
    setEmptyCollections(newEmpty);

    // Update card order
    const newOrder = { ...cardOrder };
    if (newOrder[oldName]) {
      newOrder[newName] = newOrder[oldName];
      delete newOrder[oldName];
    }
    setCardOrder(newOrder);

    // Update collected cards
    const newCollected = {};
    Object.keys(collectedCards).forEach(key => {
      if (key.startsWith(`${oldName}-`)) {
        newCollected[key.replace(`${oldName}-`, `${newName}-`)] = collectedCards[key];
      } else {
        newCollected[key] = collectedCards[key];
      }
    });
    setCollectedCards(newCollected);

    saveToFirebase({ 
      customCards: newCustom, 
      emptyCollections: newEmpty, 
      cardOrder: newOrder,
      collectedCards: newCollected 
    });
  };

  // Create empty collection
  const createCollection = (name) => {
    if (!emptyCollections.includes(name) && !allCollections.includes(name)) {
      const newEmpty = [...emptyCollections, name];
      setEmptyCollections(newEmpty);
      setExpandedSets({ ...expandedSets, [name]: true });
      saveToFirebase({ emptyCollections: newEmpty });
    }
  };

  // Bulk add cards
  const bulkAddCards = (cards, collectionName) => {
    const newCards = cards.map((card, idx) => ({
      ...card,
      id: `custom-${Date.now()}-${idx}`,
    }));
    
    const newCustom = [...customCards, ...newCards];
    setCustomCards(newCustom);
    
    // Remove from empty collections if it was empty
    const newEmpty = emptyCollections.filter(c => c !== collectionName);
    setEmptyCollections(newEmpty);
    
    // Expand the collection
    setExpandedSets({ ...expandedSets, [collectionName]: true });
    
    saveToFirebase({ customCards: newCustom, emptyCollections: newEmpty });
  };

  // Save card edits
  const saveCardEdit = (editedCard) => {
    const originalId = getCardId(selectedCard);
    const isCustom = customCards.some(c => getCardId(c) === originalId);

    if (isCustom) {
      const newCustom = customCards.map(c => 
        getCardId(c) === originalId ? editedCard : c
      );
      setCustomCards(newCustom);
      
      // Update collected status if ID changed
      const newId = getCardId(editedCard);
      if (originalId !== newId && collectedCards[originalId]) {
        const newCollected = { ...collectedCards };
        newCollected[newId] = newCollected[originalId];
        delete newCollected[originalId];
        setCollectedCards(newCollected);
        saveToFirebase({ customCards: newCustom, collectedCards: newCollected });
      } else {
        saveToFirebase({ customCards: newCustom });
      }
    }
    
    setSelectedCard(editedCard);
  };

  // Drag and drop handlers
  const handleDragStart = (e, card, setName) => {
    setDraggedCard(card);
    setDraggedSetName(setName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetCard, setName) => {
    e.preventDefault();
    if (!draggedCard || draggedSetName !== setName) return;
    
    const cards = cardsBySet[setName];
    const draggedIdx = cards.findIndex(c => getCardId(c) === getCardId(draggedCard));
    const targetIdx = cards.findIndex(c => getCardId(c) === getCardId(targetCard));
    
    if (draggedIdx === targetIdx) return;

    const newOrder = cards.map(c => getCardId(c));
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, getCardId(draggedCard));
    
    const newCardOrder = { ...cardOrder, [setName]: newOrder };
    setCardOrder(newCardOrder);
  };

  const handleDragEnd = () => {
    if (draggedSetName && cardOrder[draggedSetName]) {
      saveToFirebase({ cardOrder });
    }
    setDraggedCard(null);
    setDraggedSetName(null);
  };

  // Stats
  const totalCards = allCards.length;
  const collectedCount = Object.values(collectedCards).filter(Boolean).length;
  const percentage = totalCards > 0 ? Math.round((collectedCount / totalCards) * 100) : 0;

  // Auth functions
  const signIn = () => signInWithPopup(auth, googleProvider);
  const handleSignOut = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">MyCardVault</h1>
          <p className="text-slate-400">Track your Devin Booker card collection</p>
        </div>
        <button
          onClick={signIn}
          className="flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-4 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">MyCardVault</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterSort(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-xl border border-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Stats Card */}
      <div className="mx-4 mt-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm">Collection Progress</p>
            <p className="text-white text-2xl font-bold">{collectedCount} / {totalCards}</p>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.3)" strokeWidth="4" fill="none" />
              <circle 
                cx="32" cy="32" r="28" 
                stroke="white" 
                strokeWidth="4" 
                fill="none" 
                strokeDasharray={`${percentage * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white font-bold">
              {percentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Hint text */}
      <p className="text-center text-slate-500 text-xs mt-2 mb-4">
        ← Swipe left to delete • Drag ☰ to reorder • Tap card to edit
      </p>

      {/* Collections */}
      <div className="px-4">
        {Object.keys(cardsBySet).sort().map(setName => {
          const cards = cardsBySet[setName];
          const setCollected = cards.filter(c => collectedCards[getCardId(c)]).length;
          const isExpanded = expandedSets[setName];

          return (
            <div key={setName} className="mb-4">
              <SwipeableCollectionHeader
                setName={setName}
                cardCount={cards.length}
                collectedCount={setCollected}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedSets({ ...expandedSets, [setName]: !isExpanded })}
                onDelete={deleteCollection}
                onEdit={(name) => setEditingCollection(name)}
              />
              
              {isExpanded && (
                <div className="ml-2">
                  {cards.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      <p>No cards in this collection yet</p>
                      <button
                        onClick={() => setShowBulkAdd(true)}
                        className="mt-2 text-orange-400 hover:text-orange-300"
                      >
                        + Add cards
                      </button>
                    </div>
                  ) : (
                    cards.map(card => (
                      <SwipeableCard
                        key={getCardId(card)}
                        card={card}
                        collected={collectedCards[getCardId(card)]}
                        rarityColor={getRarityColor(card.serial)}
                        onDelete={deleteCard}
                        onToggle={toggleCard}
                        onTap={(c) => { setSelectedCard(c); setShowCardDetail(true); }}
                        onDragStart={(e, c) => handleDragStart(e, c, setName)}
                        onDragOver={(e, c) => handleDragOver(e, c, setName)}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedCard && getCardId(draggedCard) === getCardId(card)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-4 flex flex-col gap-3">
        {/* Create Collection Button */}
        <button
          onClick={() => setShowCreateCollection(true)}
          className="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Create Collection"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        
        {/* Add Cards Button */}
        <button
          onClick={() => setShowBulkAdd(true)}
          className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Add Cards"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      <CardDetailModal
        card={selectedCard}
        isOpen={showCardDetail}
        onClose={() => setShowCardDetail(false)}
        onSave={saveCardEdit}
        collected={selectedCard ? collectedCards[getCardId(selectedCard)] : false}
        onToggle={toggleCard}
      />

      <EditCollectionModal
        isOpen={!!editingCollection}
        onClose={() => setEditingCollection(null)}
        collectionName={editingCollection || ''}
        onSave={renameCollection}
      />

      <CreateCollectionModal
        isOpen={showCreateCollection}
        onClose={() => setShowCreateCollection(false)}
        onSave={createCollection}
        existingCollections={allCollections}
      />

      <BulkAddCardsModal
        isOpen={showBulkAdd}
        onClose={() => setShowBulkAdd(false)}
        onSave={bulkAddCards}
        collections={allCollections}
      />

      <FilterSortModal
        isOpen={showFilterSort}
        onClose={() => setShowFilterSort(false)}
        sortBy={sortBy}
        setSortBy={setSortBy}
        filterCollected={filterCollected}
        setFilterCollected={setFilterCollected}
      />
    </div>
  );
}
