import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import cardData from './data/bookerCards.json';

// Collection color configuration
const COLLECTION_COLORS = {
  flagship: { bg: 'bg-orange-500', text: 'text-orange-500', gradient: 'from-orange-500 to-amber-500' },
  chrome: { bg: 'bg-blue-500', text: 'text-blue-500', gradient: 'from-blue-500 to-cyan-500' },
  holiday: { bg: 'bg-green-500', text: 'text-green-500', gradient: 'from-green-500 to-emerald-500' },
  sapphire: { bg: 'bg-purple-500', text: 'text-purple-500', gradient: 'from-purple-500 to-violet-500' },
  midnight: { bg: 'bg-indigo-500', text: 'text-indigo-500', gradient: 'from-indigo-500 to-blue-900' },
  blackfriday: { bg: 'bg-gray-800', text: 'text-gray-400', gradient: 'from-gray-800 to-gray-900' }
};

// Helper function to ensure array
const ensureArray = (val) => Array.isArray(val) ? val : [];

// Flatten the nested cardData structure
const flattenCardData = (data) => {
  // If it's already an array, return it
  if (Array.isArray(data)) return data;
  
  // If it has a "sets" property (nested structure), flatten it
  if (data && data.sets) {
    const flattened = [];
    Object.entries(data.sets).forEach(([setKey, setData]) => {
      const cards = ensureArray(setData.cards || []);
      cards.forEach((card, index) => {
        flattened.push({
          id: card.id || `${setKey}_${index}`,
          setName: setData.name || setKey,
          cardName: card.cardName || card.parallel || card.name || 'Card',
          cardNumber: card.cardNumber || card.number || '',
          parallel: card.parallel || '',
          serial: card.serial || card.numbered || '',
          source: card.source || '',
          collected: false,
          collectionType: getCollectionTypeFromSetKey(setKey)
        });
      });
    });
    return flattened;
  }
  
  // If it has a "cards" property, return that
  if (data && data.cards) return ensureArray(data.cards);
  
  return [];
};

// Get collection type from set key
const getCollectionTypeFromSetKey = (setKey) => {
  const key = (setKey || '').toLowerCase();
  if (key.includes('sapphire')) return 'sapphire';
  if (key.includes('midnight')) return 'midnight';
  if (key.includes('chrome')) return 'chrome';
  if (key.includes('holiday')) return 'holiday';
  if (key.includes('black-friday') || key.includes('blackfriday')) return 'blackfriday';
  return 'flagship';
};

// Helper function to detect collection type from set name
const getCollectionType = (setName) => {
  const name = (setName || '').toLowerCase();
  if (name.includes('sapphire')) return 'sapphire';
  if (name.includes('midnight')) return 'midnight';
  if (name.includes('chrome')) return 'chrome';
  if (name.includes('holiday')) return 'holiday';
  if (name.includes('black friday') || name.includes('blackfriday')) return 'blackfriday';
  return 'flagship';
};

// Generate unique ID
const generateId = () => `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ===== LOGIN SCREEN =====
const LoginScreen = ({ onLogin, loading }) => (
  <div className="min-h-screen bg-black relative overflow-hidden">
    {/* Background Image */}
    <div className="absolute inset-0">
      <img 
        src="/booker-jersey.jpg"
        alt="Devin Booker" 
        className="w-full h-full object-cover"
        style={{ objectPosition: 'center 40%' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
    </div>
    
    {/* Content */}
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-5">
        <span className="text-white text-xl font-black tracking-tight">MyCardVault</span>
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Bottom content */}
      <div className="p-5 pb-8 space-y-5">
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight">
            Track Your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Devin Booker</span><br />
            Cards
          </h1>
          <p className="text-slate-400 text-lg mt-3">
            The ultimate 2025-26 Topps collection tracker
          </p>
        </div>
        
        {/* Features */}
        <div className="flex gap-5 text-sm">
          {['258+ Cards', 'All Parallels', 'Free'].map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-300">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>{f}</span>
            </div>
          ))}
        </div>
        
        {/* Sign In Button */}
        <button
          onClick={onLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 shadow-2xl"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

// ===== SWIPEABLE CARD ITEM =====
const SwipeableCard = ({ card, onDelete, onEdit, onDuplicate, onToggleCollected, onDragStart, onDragEnd, onDragOver, isDragging, collectionColor }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const cardRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.target.closest('.drag-handle')) return;
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX;
    if (diff < 0) setSwipeX(Math.max(diff, -120));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < -80) {
      setSwipeX(-120);
    } else {
      setSwipeX(0);
    }
  };

  const rarityColor = card.serial === '1/1' ? 'bg-yellow-500' : 
                      card.serial?.includes('/5') ? 'bg-red-500' :
                      card.serial?.includes('/10') ? 'bg-orange-500' :
                      card.serial?.includes('/25') ? 'bg-purple-500' :
                      card.serial?.includes('/50') ? 'bg-blue-500' :
                      card.serial?.includes('/99') ? 'bg-green-500' :
                      'bg-slate-600';

  return (
    <div className="relative overflow-hidden rounded-xl mb-2">
      {/* Delete/Edit/Duplicate Actions */}
      <div className="absolute inset-y-0 right-0 flex">
        <button onClick={() => onDuplicate(card)} className="w-14 bg-blue-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button onClick={() => onEdit(card)} className="w-14 bg-amber-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button onClick={() => onDelete(card.id)} className="w-14 bg-red-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Card Content */}
      <div
        ref={cardRef}
        className={`relative bg-slate-800 p-3 flex items-center gap-3 transition-transform ${isDragging ? 'opacity-50 scale-95' : ''}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        draggable
        onDragStart={(e) => onDragStart(e, card)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, card)}
      >
        {/* Drag Handle */}
        <div className="drag-handle cursor-grab active:cursor-grabbing touch-none">
          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
          </svg>
        </div>

        {/* Color indicator */}
        <div className={`w-1 h-10 rounded-full ${card.collected ? (collectionColor?.bg || rarityColor) : 'bg-slate-600'}`} />

        {/* Card info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {card.cardName || card.parallel || card.setName || 'Card'}
          </p>
          <p className="text-slate-400 text-sm truncate">
            {card.cardNumber && `#${card.cardNumber}`} {card.serial && `• ${card.serial}`}
          </p>
        </div>

        {/* Collected checkbox */}
        <button
          onClick={() => onToggleCollected(card.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            card.collected ? 'bg-orange-500 border-orange-500' : 'border-slate-500'
          }`}
        >
          {card.collected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

// ===== COLLECTION SECTION =====
const CollectionSection = ({ 
  setName, 
  cards, 
  collectionType,
  onDeleteCard, 
  onEditCard, 
  onDuplicateCard, 
  onToggleCollected,
  onEditCollection,
  onDeleteCollection,
  onDragStart,
  onDragEnd,
  onDragOver,
  draggedCard
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = COLLECTION_COLORS[collectionType] || COLLECTION_COLORS.flagship;
  const collected = cards.filter(c => c.collected).length;
  const total = cards.length;
  const progress = total > 0 ? Math.round((collected / total) * 100) : 0;

  return (
    <div className="mb-4">
      {/* Collection Header */}
      <div 
        className="bg-slate-800/80 rounded-xl p-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`w-1.5 h-10 rounded-full ${colors.bg}`} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{setName}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs">{collected}/{total}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEditCollection(setName); }}
            className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center hover:bg-slate-600"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteCollection(setName); }}
            className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center hover:bg-red-500/20"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <svg 
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Cards */}
      {isExpanded && (
        <div className="mt-2 ml-4">
          {cards.map(card => (
            <SwipeableCard
              key={card.id}
              card={card}
              onDelete={onDeleteCard}
              onEdit={onEditCard}
              onDuplicate={onDuplicateCard}
              onToggleCollected={onToggleCollected}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              isDragging={draggedCard?.id === card.id}
              collectionColor={colors}
            />
          ))}
          {cards.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">No cards in this collection</p>
          )}
        </div>
      )}
    </div>
  );
};

// ===== EDIT CARD MODAL =====
const EditCardModal = ({ isOpen, onClose, card, onSave }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (card) {
      setFormData({
        cardName: card.cardName || card.parallel || '',
        cardNumber: card.cardNumber || '',
        parallel: card.parallel || '',
        serial: card.serial || '',
        source: card.source || '',
        notes: card.notes || ''
      });
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...card, ...formData });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold">Edit Card</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Card Name</label>
              <input
                type="text"
                value={formData.cardName}
                onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Card Number</label>
              <input
                type="text"
                value={formData.cardNumber}
                onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Parallel/Variation</label>
              <input
                type="text"
                value={formData.parallel}
                onChange={(e) => setFormData({ ...formData, parallel: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Serial Number</label>
              <input
                type="text"
                value={formData.serial}
                onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                placeholder="e.g., /99, 1/1"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Source</label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="e.g., Hobby, Retail"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ===== EDIT COLLECTION MODAL =====
const EditCollectionModal = ({ isOpen, onClose, collectionName, onSave }) => {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (collectionName) setNewName(collectionName);
  }, [collectionName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newName.trim() && newName !== collectionName) {
      onSave(collectionName, newName.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-white text-lg font-bold mb-4">Edit Collection</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ===== ADD COLLECTION MODAL =====
const AddCollectionModal = ({ isOpen, onClose, onAddCollection, existingCollections }) => {
  const [collectionName, setCollectionName] = useState('');
  const [collectionType, setCollectionType] = useState('flagship');

  useEffect(() => {
    if (isOpen) {
      setCollectionName('');
      setCollectionType('flagship');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (collectionName.trim()) {
      onAddCollection(collectionName.trim(), collectionType);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-white text-lg font-bold mb-4">Add New Collection</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Collection Name</label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g., Sapphire - Base Card"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Collection Type</label>
              <select
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="flagship">Flagship</option>
                <option value="chrome">Chrome</option>
                <option value="holiday">Holiday</option>
                <option value="sapphire">Sapphire</option>
                <option value="midnight">Midnight</option>
                <option value="blackfriday">Black Friday</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium">
                Add Collection
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ===== ADD CARDS MODAL (BULK) =====
const AddCardsModal = ({ isOpen, onClose, onAddCards, collections }) => {
  const [selectedCollection, setSelectedCollection] = useState('');
  const [cards, setCards] = useState([{ cardName: '', cardNumber: '', parallel: '', serial: '' }]);

  useEffect(() => {
    if (isOpen) {
      setSelectedCollection(collections[0] || '');
      setCards([{ cardName: '', cardNumber: '', parallel: '', serial: '' }]);
    }
  }, [isOpen, collections]);

  if (!isOpen) return null;

  const handleAddAnother = () => {
    setCards([...cards, { cardName: '', cardNumber: '', parallel: '', serial: '' }]);
  };

  const handleRemoveCard = (index) => {
    if (cards.length > 1) {
      setCards(cards.filter((_, i) => i !== index));
    }
  };

  const handleCardChange = (index, field, value) => {
    const updated = [...cards];
    updated[index][field] = value;
    setCards(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validCards = cards.filter(c => c.cardName.trim() || c.parallel.trim());
    if (validCards.length > 0 && selectedCollection) {
      onAddCards(selectedCollection, validCards);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold">Add Cards</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Collection</label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              >
                {collections.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {cards.map((card, index) => (
                <div key={index} className="bg-slate-700/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Card {index + 1}</span>
                    {cards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(index)}
                        className="text-red-400 text-sm hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Card Name"
                      value={card.cardName}
                      onChange={(e) => handleCardChange(index, 'cardName', e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Card #"
                      value={card.cardNumber}
                      onChange={(e) => handleCardChange(index, 'cardNumber', e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Parallel"
                      value={card.parallel}
                      onChange={(e) => handleCardChange(index, 'parallel', e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Serial (e.g., /99)"
                      value={card.serial}
                      onChange={(e) => handleCardChange(index, 'serial', e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddAnother}
              className="w-full py-2 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 font-medium hover:border-orange-500 hover:text-orange-500 transition-colors"
            >
              + Add Another Card
            </button>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium">
                Save All ({cards.filter(c => c.cardName.trim() || c.parallel.trim()).length})
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ===== FILTER/SORT MODAL =====
const FilterSortModal = ({ isOpen, onClose, sortBy, setSortBy, filterCollected, setFilterCollected }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-white text-lg font-bold mb-4">Filter & Sort</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Sort By</label>
              <div className="grid grid-cols-2 gap-2">
                {['default', 'name', 'number', 'collected', 'custom'].map(option => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      sortBy === option ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Filter</label>
              <div className="grid grid-cols-3 gap-2">
                {['all', 'collected', 'needed'].map(option => (
                  <button
                    key={option}
                    onClick={() => setFilterCollected(option)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      filterCollected === option ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl bg-slate-700 text-white font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== MAIN APP =====
export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Data state
  const [cards, setCards] = useState([]);
  const [customOrder, setCustomOrder] = useState({});
  const [hiddenCards, setHiddenCards] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // UI state
  const [activeCollection, setActiveCollection] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [filterCollected, setFilterCollected] = useState('all');
  const [draggedCard, setDraggedCard] = useState(null);

  // Modal state
  const [editingCard, setEditingCard] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [showAddCards, setShowAddCards] = useState(false);
  const [showFilterSort, setShowFilterSort] = useState(false);

  // Auth effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Initialize default cards from JSON
  const defaultCards = useMemo(() => flattenCardData(cardData), []);

  // Save to Firebase
  const saveToFirebase = useCallback(async (newCards, newCustomOrder = customOrder, newHiddenCards = hiddenCards) => {
    if (!user) return;
    setSyncing(true);
    setSaveError(false);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        cards: newCards,
        customOrder: newCustomOrder,
        hiddenCards: newHiddenCards,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Save error:', error);
      setSaveError(true);
    } finally {
      setSyncing(false);
    }
  }, [user, customOrder, hiddenCards]);

  // Firebase sync effect
  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedCards = ensureArray(data.cards);
        // If user has no cards saved, initialize with default cards
        if (loadedCards.length === 0 && defaultCards.length > 0) {
          setCards(defaultCards);
          saveToFirebase(defaultCards, {}, []);
        } else {
          setCards(loadedCards);
        }
        setCustomOrder(data.customOrder || {});
        setHiddenCards(ensureArray(data.hiddenCards));
      } else {
        // New user - initialize with default cards
        if (defaultCards.length > 0) {
          setCards(defaultCards);
          saveToFirebase(defaultCards, {}, []);
        }
      }
    });

    return () => unsubscribe();
  }, [user, defaultCards, saveToFirebase]);

  // Auth handlers
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Card handlers
  const handleToggleCollected = (cardId) => {
    const updated = cards.map(c => 
      c.id === cardId ? { ...c, collected: !c.collected } : c
    );
    setCards(updated);
    saveToFirebase(updated);
  };

  const handleDeleteCard = (cardId) => {
    const cardToDelete = cards.find(c => c.id === cardId);
    const updated = cards.filter(c => c.id !== cardId);
    const newHidden = [...hiddenCards, cardToDelete];
    setCards(updated);
    setHiddenCards(newHidden);
    saveToFirebase(updated, customOrder, newHidden);
  };

  const handleEditCard = (card) => {
    setEditingCard(card);
  };

  const handleSaveCard = (updatedCard) => {
    const updated = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
    setCards(updated);
    saveToFirebase(updated);
    setEditingCard(null);
  };

  const handleDuplicateCard = (card) => {
    const newCard = {
      ...card,
      id: generateId(),
      collected: false
    };
    const updated = [...cards, newCard];
    setCards(updated);
    saveToFirebase(updated);
  };

  // Collection handlers
  const handleEditCollection = (collectionName) => {
    setEditingCollection(collectionName);
  };

  const handleSaveCollection = (oldName, newName) => {
    const updated = cards.map(c => 
      c.setName === oldName ? { ...c, setName: newName } : c
    );
    setCards(updated);
    saveToFirebase(updated);
    setEditingCollection(null);
  };

  const handleDeleteCollection = (collectionName) => {
    const toDelete = cards.filter(c => c.setName === collectionName);
    const updated = cards.filter(c => c.setName !== collectionName);
    const newHidden = [...hiddenCards, ...toDelete];
    setCards(updated);
    setHiddenCards(newHidden);
    saveToFirebase(updated, customOrder, newHidden);
  };

  const handleAddCollection = (name, type) => {
    // Just add an empty collection entry
    const newCard = {
      id: generateId(),
      setName: name,
      cardName: 'Base',
      cardNumber: '',
      parallel: '',
      serial: '',
      collected: false,
      collectionType: type
    };
    const updated = [...cards, newCard];
    setCards(updated);
    saveToFirebase(updated);
  };

  const handleAddCards = (collectionName, newCards) => {
    const existingCard = cards.find(c => c.setName === collectionName);
    const collectionType = existingCard?.collectionType || getCollectionType(collectionName);
    
    const cardsToAdd = newCards.map(card => ({
      id: generateId(),
      setName: collectionName,
      cardName: card.cardName || card.parallel || 'Card',
      cardNumber: card.cardNumber,
      parallel: card.parallel,
      serial: card.serial,
      collected: false,
      collectionType
    }));
    
    const updated = [...cards, ...cardsToAdd];
    setCards(updated);
    saveToFirebase(updated);
  };

  // Drag handlers
  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const handleDragOver = (e, targetCard) => {
    e.preventDefault();
    if (!draggedCard || draggedCard.id === targetCard.id) return;
    if (draggedCard.setName !== targetCard.setName) return;

    const setCards = cards.filter(c => c.setName === draggedCard.setName);
    const otherCards = cards.filter(c => c.setName !== draggedCard.setName);
    
    const dragIndex = setCards.findIndex(c => c.id === draggedCard.id);
    const targetIndex = setCards.findIndex(c => c.id === targetCard.id);
    
    const reordered = [...setCards];
    reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, draggedCard);
    
    const newOrder = { ...customOrder, [draggedCard.setName]: reordered.map(c => c.id) };
    const updated = [...otherCards, ...reordered];
    
    setCards(updated);
    setCustomOrder(newOrder);
    saveToFirebase(updated, newOrder);
  };

  // Computed data
  const collections = useMemo(() => {
    const sets = {};
    cards.forEach(card => {
      const setName = card.setName || 'Uncategorized';
      if (!sets[setName]) sets[setName] = [];
      sets[setName].push(card);
    });
    return sets;
  }, [cards]);

  const collectionTypes = useMemo(() => {
    const types = {};
    Object.keys(collections).forEach(setName => {
      const firstCard = collections[setName][0];
      types[setName] = firstCard?.collectionType || getCollectionType(setName);
    });
    return types;
  }, [collections]);

  const stats = useMemo(() => {
    const byType = {};
    let totalCollected = 0;
    let totalCards = 0;

    cards.forEach(card => {
      const type = card.collectionType || getCollectionType(card.setName);
      if (!byType[type]) byType[type] = { collected: 0, total: 0 };
      byType[type].total++;
      totalCards++;
      if (card.collected) {
        byType[type].collected++;
        totalCollected++;
      }
    });

    return { byType, totalCollected, totalCards };
  }, [cards]);

  const filteredCollections = useMemo(() => {
    let result = { ...collections };

    // Filter by active collection type
    if (activeCollection !== 'all') {
      result = Object.fromEntries(
        Object.entries(result).filter(([setName]) => 
          collectionTypes[setName] === activeCollection
        )
      );
    }

    // Apply collected filter
    if (filterCollected !== 'all') {
      Object.keys(result).forEach(setName => {
        result[setName] = result[setName].filter(card =>
          filterCollected === 'collected' ? card.collected : !card.collected
        );
      });
      // Remove empty collections
      result = Object.fromEntries(
        Object.entries(result).filter(([_, cards]) => cards.length > 0)
      );
    }

    // Apply sorting
    Object.keys(result).forEach(setName => {
      const setCards = [...result[setName]];
      switch (sortBy) {
        case 'name':
          setCards.sort((a, b) => (a.cardName || '').localeCompare(b.cardName || ''));
          break;
        case 'number':
          setCards.sort((a, b) => (a.cardNumber || '').localeCompare(b.cardNumber || '', undefined, { numeric: true }));
          break;
        case 'collected':
          setCards.sort((a, b) => (b.collected ? 1 : 0) - (a.collected ? 1 : 0));
          break;
        case 'custom':
          if (customOrder[setName]) {
            const order = customOrder[setName];
            setCards.sort((a, b) => {
              const aIndex = order.indexOf(a.id);
              const bIndex = order.indexOf(b.id);
              return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            });
          }
          break;
      }
      result[setName] = setCards;
    });

    return result;
  }, [collections, collectionTypes, activeCollection, filterCollected, sortBy, customOrder]);

  const overallProgress = stats.totalCards > 0 
    ? Math.round((stats.totalCollected / stats.totalCards) * 100) 
    : 0;

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} />;
  }

  // Main app
  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-orange-500/20 to-transparent px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white text-lg font-black tracking-tight">MyCardVault</span>
          <div className="flex items-center gap-2">
            {syncing && (
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            )}
            {saveError && (
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-bold text-lg">Devin Booker</h2>
              <p className="text-slate-400 text-sm">2025-26 Topps Collection</p>
            </div>
            <div className="text-right">
              <p className="text-orange-500 font-bold text-2xl">{stats.totalCollected}</p>
              <p className="text-slate-500 text-xs">of {stats.totalCards}</p>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" 
              style={{ width: `${overallProgress}%` }} 
            />
          </div>

          {/* Collection Type Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveCollection('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCollection === 'all' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              All ({stats.totalCards})
            </button>
            {Object.entries(stats.byType).map(([type, { collected, total }]) => {
              const colors = COLLECTION_COLORS[type] || COLLECTION_COLORS.flagship;
              const isActive = activeCollection === type;
              return (
                <button
                  key={type}
                  onClick={() => setActiveCollection(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? `${colors.bg} text-white` : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} ({collected}/{total})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => setShowAddCollection(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Collection
        </button>
        <button
          onClick={() => setShowAddCards(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Cards
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowFilterSort(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
        </button>
      </div>

      {/* Collections List */}
      <div className="px-4">
        {Object.entries(filteredCollections).map(([setName, setCards]) => (
          <CollectionSection
            key={setName}
            setName={setName}
            cards={setCards}
            collectionType={collectionTypes[setName]}
            onDeleteCard={handleDeleteCard}
            onEditCard={handleEditCard}
            onDuplicateCard={handleDuplicateCard}
            onToggleCollected={handleToggleCollected}
            onEditCollection={handleEditCollection}
            onDeleteCollection={handleDeleteCollection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            draggedCard={draggedCard}
          />
        ))}

        {Object.keys(filteredCollections).length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No collections found</p>
            <button
              onClick={() => setShowAddCollection(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-white font-medium"
            >
              Add Your First Collection
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <EditCardModal
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        card={editingCard}
        onSave={handleSaveCard}
      />

      <EditCollectionModal
        isOpen={!!editingCollection}
        onClose={() => setEditingCollection(null)}
        collectionName={editingCollection}
        onSave={handleSaveCollection}
      />

      <AddCollectionModal
        isOpen={showAddCollection}
        onClose={() => setShowAddCollection(false)}
        onAddCollection={handleAddCollection}
        existingCollections={Object.keys(collections)}
      />

      <AddCardsModal
        isOpen={showAddCards}
        onClose={() => setShowAddCards(false)}
        onAddCards={handleAddCards}
        collections={Object.keys(collections)}
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
