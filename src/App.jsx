import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import cardData from './data/bookerCards.json';

// 5 Collection Types (Black Friday goes under Flagship)
const COLLECTION_COLORS = {
  flagship: { bg: 'bg-orange-500', text: 'text-orange-500', gradient: 'from-orange-500 to-amber-500', label: 'Flagship' },
  chrome: { bg: 'bg-blue-500', text: 'text-blue-500', gradient: 'from-blue-500 to-cyan-500', label: 'Chrome' },
  holiday: { bg: 'bg-green-500', text: 'text-green-500', gradient: 'from-green-500 to-emerald-500', label: 'Holiday' },
  sapphire: { bg: 'bg-purple-500', text: 'text-purple-500', gradient: 'from-purple-500 to-violet-500', label: 'Sapphire' },
  midnight: { bg: 'bg-indigo-500', text: 'text-indigo-500', gradient: 'from-indigo-500 to-blue-900', label: 'Midnight' }
};

// Helper function to ensure array
const ensureArray = (val) => Array.isArray(val) ? val : [];

// Investment calculation utilities
const calculateGain = (purchasePrice, currentValue) => {
  if (!purchasePrice || !currentValue) return null;
  return currentValue - purchasePrice;
};

const calculateGainPercent = (purchasePrice, currentValue) => {
  if (!purchasePrice || !currentValue || purchasePrice === 0) return null;
  return ((currentValue - purchasePrice) / purchasePrice) * 100;
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-';
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPercent = (percent) => {
  if (percent === null || percent === undefined) return '-';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
};

// Flatten the nested cardData structure
const flattenCardData = (data) => {
  if (Array.isArray(data)) return data;
  
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
          collectionType: getCollectionTypeFromSetKey(setKey),
          purchasePrice: null,
          purchaseDate: null,
          currentValue: null
        });
      });
    });
    return flattened;
  }
  
  if (data && data.cards) return ensureArray(data.cards);
  return [];
};

// Get collection type from set key (Black Friday → Flagship)
const getCollectionTypeFromSetKey = (setKey) => {
  const key = (setKey || '').toLowerCase();
  if (key.includes('sapphire')) return 'sapphire';
  if (key.includes('midnight')) return 'midnight';
  if (key.includes('chrome')) return 'chrome';
  if (key.includes('holiday')) return 'holiday';
  return 'flagship';
};

// Get collection type from set name
const getCollectionType = (setName) => {
  const name = (setName || '').toLowerCase();
  if (name.includes('sapphire')) return 'sapphire';
  if (name.includes('midnight')) return 'midnight';
  if (name.includes('chrome')) return 'chrome';
  if (name.includes('holiday')) return 'holiday';
  return 'flagship';
};

// Generate unique ID
const generateId = () => `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ===== iOS-STYLE GLOBAL ANIMATIONS (CHANGE #3) =====
const IOSStyles = () => (
  <style>{`
    * { -webkit-tap-highlight-color: transparent; }
    html { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
    body { overscroll-behavior-y: none; }
    
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.92); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes checkPop {
      0% { transform: scale(1); }
      50% { transform: scale(1.25); }
      100% { transform: scale(1); }
    }
    
    .ios-slide-up { animation: slideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1); }
    .ios-fade-in { animation: fadeIn 0.25s ease-out; }
    .ios-scale-in { animation: scaleIn 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
    .ios-slide-down { animation: slideDown 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
    .ios-check-pop { animation: checkPop 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
    
    .ios-press { transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease; }
    .ios-press:active { transform: scale(0.97); opacity: 0.8; }
    
    .ios-card {
      transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease;
    }
    .ios-card:active { transform: scale(0.98); }
    
    .ios-modal-backdrop {
      animation: fadeIn 0.2s ease-out;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .ios-modal-content {
      animation: slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1);
    }
    
    .ios-blur {
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
    }
    
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    .collection-cards-enter { animation: fadeIn 0.2s ease-out, slideDown 0.25s cubic-bezier(0.32, 0.72, 0, 1); }

    .menu-dropdown { animation: scaleIn 0.15s cubic-bezier(0.32, 0.72, 0, 1); transform-origin: top right; }

    .drag-item-active {
      z-index: 100;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.3);
      transform: scale(1.03);
      opacity: 0.95;
    }
    .drag-placeholder {
      background: rgba(249,115,22,0.08);
      border: 2px dashed rgba(249,115,22,0.3);
      border-radius: 1rem;
      transition: height 0.2s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .drag-handle {
      touch-action: none;
      cursor: grab;
    }
    .drag-handle:active { cursor: grabbing; }
    .drag-transition {
      transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
    }
  `}</style>
);

// ===== LOGIN SCREEN =====
const LoginScreen = ({ onLogin, loading }) => (
  <div className="min-h-screen bg-black relative overflow-hidden">
    <IOSStyles />
    <div className="absolute inset-0">
      <img 
        src="/booker-jersey.jpg"
        alt="Devin Booker" 
        className="w-full h-full object-cover"
        style={{ objectPosition: 'center 40%' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
    </div>
    
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="p-5">
        <span className="text-white text-xl font-black tracking-tight">MyCardVault</span>
      </div>
      
      <div className="flex-1" />
      
      <div className="p-5 pb-8 space-y-5 ios-slide-up">
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
        
        <button
          onClick={onLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 shadow-2xl ios-press"
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

// ===== HIDDEN CARDS RECOVERY MODAL =====
const HiddenCardsModal = ({ isOpen, onClose, hiddenCards, onRestore }) => {
  const [selectedCards, setSelectedCards] = useState([]);
  
  const hiddenByCollection = useMemo(() => {
    const grouped = {};
    hiddenCards.forEach(card => {
      const setName = card.setName || 'Uncategorized';
      if (!grouped[setName]) grouped[setName] = [];
      grouped[setName].push(card);
    });
    return grouped;
  }, [hiddenCards]);
  
  if (!isOpen) return null;
  
  const handleToggleCard = (cardId) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };
  
  const handleRestoreSelected = () => {
    if (selectedCards.length > 0) {
      onRestore(selectedCards);
      setSelectedCards([]);
    }
  };
  
  const handleRestoreCollection = (setName) => {
    const collectionCards = hiddenByCollection[setName].map(c => c.id);
    onRestore(collectionCards);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white text-lg font-bold">Hidden Cards Recovery</h3>
              <p className="text-slate-400 text-sm">Restore deleted cards and collections</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center ios-press">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {hiddenCards.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-400">No hidden cards to restore</p>
              <p className="text-slate-500 text-sm mt-1">All your cards are safe!</p>
            </div>
          ) : (
            <>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-orange-400 text-sm font-medium">Your data is safe!</p>
                    <p className="text-orange-300/80 text-xs mt-0.5">Found {hiddenCards.length} hidden card{hiddenCards.length !== 1 ? 's' : ''} across {Object.keys(hiddenByCollection).length} collection{Object.keys(hiddenByCollection).length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-4">
                {Object.entries(hiddenByCollection).map(([setName, cards]) => (
                  <div key={setName} className="bg-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-white font-semibold">{setName}</h4>
                        <p className="text-slate-400 text-sm">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
                      </div>
                      <button
                        onClick={() => handleRestoreCollection(setName)}
                        className="px-3 py-1.5 rounded-2xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors ios-press"
                      >
                        Restore All
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {cards.map(card => (
                        <div key={card.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedCards.includes(card.id)}
                            onChange={() => handleToggleCard(card.id)}
                            className="w-4 h-4 rounded border-slate-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-800"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {card.cardName || card.parallel || 'Card'}
                            </p>
                            <p className="text-slate-400 text-xs">
                              {card.cardNumber && `#${card.cardNumber}`} {card.serial && `• ${card.serial}`}
                            </p>
                          </div>
                          {card.collected && (
                            <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">Collected</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-700">
                <button 
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-medium ios-press"
                >
                  Close
                </button>
                <button
                  onClick={handleRestoreSelected}
                  disabled={selectedCards.length === 0}
                  className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ios-press"
                >
                  Restore Selected ({selectedCards.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== PORTFOLIO VALUE CARD =====
const PortfolioValueCard = ({ cards }) => {
  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let cardsValued = 0;
    
    cards.forEach(card => {
      if (card.purchasePrice) {
        totalInvested += parseFloat(card.purchasePrice);
      }
      if (card.currentValue) {
        totalCurrentValue += parseFloat(card.currentValue);
        if (card.purchasePrice) cardsValued++;
      }
    });
    
    const totalGain = totalCurrentValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;
    const avgCardValue = cardsValued > 0 ? totalCurrentValue / cardsValued : 0;
    
    return {
      totalInvested,
      totalCurrentValue,
      totalGain,
      totalGainPercent,
      cardsValued,
      totalCards: cards.filter(c => c.collected).length,
      avgCardValue
    };
  }, [cards]);
  
  const isPositive = stats.totalGain >= 0;
  
  return (
    <div className={`ios-blur rounded-2xl p-4 border ${
      isPositive 
        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/20' 
        : 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border-red-500/20'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-slate-400 text-sm mb-1">Portfolio Value</p>
          <p className="text-white font-bold text-3xl">{formatCurrency(stats.totalCurrentValue)}</p>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
            isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <svg className={`w-3.5 h-3.5 ${isPositive ? 'text-green-400' : 'text-red-400 rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(stats.totalGainPercent)}
            </span>
          </div>
          <p className={`text-xs mt-1 font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(stats.totalGain)}
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-3 pt-3 border-t ${isPositive ? 'border-green-500/20' : 'border-red-500/20'}`}>
        <div>
          <p className="text-slate-400 text-xs">Invested</p>
          <p className="text-white font-semibold">{formatCurrency(stats.totalInvested)}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Cards Valued</p>
          <p className="text-white font-semibold">{stats.cardsValued}/{stats.totalCards}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Avg. Card</p>
          <p className="text-white font-semibold">{formatCurrency(stats.avgCardValue)}</p>
        </div>
      </div>
    </div>
  );
};

// ===== TOP PERFORMERS (CHANGE #4: border colors removed) =====
const TopPerformers = ({ cards }) => {
  const performers = useMemo(() => {
    const withGains = cards
      .filter(c => c.collected && c.purchasePrice && c.currentValue)
      .map(c => ({
        ...c,
        gain: calculateGain(c.purchasePrice, c.currentValue),
        gainPercent: calculateGainPercent(c.purchasePrice, c.currentValue)
      }))
      .sort((a, b) => b.gainPercent - a.gainPercent);
    
    const top = withGains.slice(0, 2);
    const bottom = withGains.slice(-1);
    
    return [...top, ...bottom];
  }, [cards]);
  
  if (performers.length === 0) return null;
  
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold text-sm">🔥 Top Performers</h3>
      </div>
      
      <div className="space-y-2">
        {performers.map((card) => {
          const isPositive = card.gain >= 0;
          
          return (
            <div key={card.id} className="bg-slate-800/80 rounded-2xl p-3 ios-card">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{card.cardName || card.parallel}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {card.setName} • {card.cardNumber && `#${card.cardNumber}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(card.gainPercent)}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {formatCurrency(card.purchasePrice)} → {formatCurrency(card.currentValue)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== DRAG AND DROP HOOK =====
const useLongPressDrag = ({ items, onReorder, enabled = true }) => {
  const containerRef = useRef(null);
  const dragState = useRef({
    active: false,
    itemIndex: -1,
    startY: 0,
    currentY: 0,
    longPressTimer: null,
    itemHeights: [],
    dragOffset: 0,
    moved: false,
    cloneEl: null,
    placeholderIndex: -1
  });
  const [dragIndex, setDragIndex] = useState(-1);
  const [placeholderIndex, setPlaceholderIndex] = useState(-1);

  const cleanup = useCallback(() => {
    const ds = dragState.current;
    if (ds.longPressTimer) clearTimeout(ds.longPressTimer);
    if (ds.cloneEl && ds.cloneEl.parentNode) ds.cloneEl.parentNode.removeChild(ds.cloneEl);
    ds.active = false;
    ds.itemIndex = -1;
    ds.cloneEl = null;
    ds.moved = false;
    setDragIndex(-1);
    setPlaceholderIndex(-1);
  }, []);

  const getItemElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.children).filter(el => el.dataset.dragIndex !== undefined);
  }, []);

  const handleStart = useCallback((index, e) => {
    if (!enabled || items.length <= 1) return;
    e.preventDefault();
    const ds = dragState.current;
    const touch = e.touches ? e.touches[0] : e;
    ds.startY = touch.clientY;
    ds.currentY = touch.clientY;
    ds.itemIndex = index;
    ds.moved = false;

    ds.longPressTimer = setTimeout(() => {
      const itemEls = getItemElements();
      if (!itemEls[index]) return;

      ds.itemHeights = itemEls.map(el => el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginBottom || 0));
      const rect = itemEls[index].getBoundingClientRect();
      ds.dragOffset = ds.startY - rect.top;

      // Create floating clone
      const clone = itemEls[index].cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.left = rect.left + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '9999';
      clone.style.transition = 'transform 0.05s ease-out, box-shadow 0.2s ease';
      clone.style.boxShadow = '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.3)';
      clone.style.transform = 'scale(1.03)';
      clone.style.opacity = '0.95';
      clone.style.borderRadius = '1rem';
      document.body.appendChild(clone);
      ds.cloneEl = clone;

      ds.active = true;
      ds.placeholderIndex = index;
      setDragIndex(index);
      setPlaceholderIndex(index);

      // Haptic feedback on supported devices
      if (navigator.vibrate) navigator.vibrate(30);
    }, 300);
  }, [enabled, items.length, getItemElements]);

  const handleMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.active && ds.longPressTimer) {
      const touch = e.touches ? e.touches[0] : e;
      if (Math.abs(touch.clientY - ds.startY) > 8) {
        clearTimeout(ds.longPressTimer);
        ds.longPressTimer = null;
        return;
      }
    }
    if (!ds.active) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    ds.currentY = touch.clientY;
    ds.moved = true;

    // Move clone
    if (ds.cloneEl) {
      ds.cloneEl.style.top = (ds.currentY - ds.dragOffset) + 'px';
    }

    // Calculate new placeholder position
    let accumulatedHeight = 0;
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeY = ds.currentY - containerRect.top + containerRef.current.scrollTop;

    let newPlaceholderIndex = items.length - 1;
    for (let i = 0; i < ds.itemHeights.length; i++) {
      accumulatedHeight += ds.itemHeights[i];
      if (relativeY < accumulatedHeight - ds.itemHeights[i] / 2) {
        newPlaceholderIndex = i;
        break;
      }
    }

    if (newPlaceholderIndex !== ds.placeholderIndex) {
      ds.placeholderIndex = newPlaceholderIndex;
      setPlaceholderIndex(newPlaceholderIndex);
    }
  }, [items.length, getItemElements]);

  const handleEnd = useCallback(() => {
    const ds = dragState.current;
    if (ds.longPressTimer) {
      clearTimeout(ds.longPressTimer);
      ds.longPressTimer = null;
    }

    if (ds.active && ds.moved && ds.placeholderIndex !== ds.itemIndex) {
      const newItems = [...items];
      const [moved] = newItems.splice(ds.itemIndex, 1);
      newItems.splice(ds.placeholderIndex, 0, moved);
      onReorder(newItems);
    }
    cleanup();
  }, [items, onReorder, cleanup]);

  useEffect(() => {
    const onTouchMove = (e) => handleMove(e);
    const onTouchEnd = () => handleEnd();
    const onMouseMove = (e) => handleMove(e);
    const onMouseUp = () => handleEnd();

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      cleanup();
    };
  }, [handleMove, handleEnd, cleanup]);

  const getDragHandleProps = useCallback((index) => ({
    onTouchStart: (e) => handleStart(index, e),
    onMouseDown: (e) => handleStart(index, e),
    className: 'drag-handle',
  }), [handleStart]);

  return {
    containerRef,
    getDragHandleProps,
    dragIndex,
    placeholderIndex,
    isDragging: dragIndex >= 0,
  };
};

// ===== THREE DOT MENU (CHANGE #2: reusable wrapper) =====
const ThreeDotMenu = ({ children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-8 h-8 rounded-full hover:bg-slate-600/50 flex items-center justify-center transition-colors ios-press"
      >
        <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="19" r="2"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-slate-700 rounded-2xl shadow-2xl border border-slate-600 py-1.5 z-50 min-w-[160px] menu-dropdown overflow-hidden">
          {React.Children.map(children, child => 
            child ? React.cloneElement(child, { onAfterClick: () => setIsOpen(false) }) : null
          )}
        </div>
      )}
    </div>
  );
};

// Menu item component
const MenuItem = ({ icon, label, onClick, danger = false, onAfterClick }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); onAfterClick?.(); }}
    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
      danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white hover:bg-slate-600/50'
    }`}
  >
    <svg className={`w-4 h-4 ${danger ? '' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
    </svg>
    <span className="text-sm font-medium">{label}</span>
  </button>
);

// ===== CARD ITEM =====
const CardItem = ({
  card,
  onToggleCollected,
  onEdit,
  onDuplicate,
  onDelete,
  collectionColor,
  dragHandleProps,
  isDragTarget,
}) => {
  const gain = calculateGain(card.purchasePrice, card.currentValue);
  const gainPercent = calculateGainPercent(card.purchasePrice, card.currentValue);
  const hasInvestmentData = card.purchasePrice && card.currentValue;

  let indicatorColor = 'bg-slate-600';
  if (card.collected && hasInvestmentData) {
    indicatorColor = gain >= 0 ? 'bg-green-500' : 'bg-red-500';
  } else if (card.collected) {
    indicatorColor = collectionColor?.bg || 'bg-slate-600';
  }

  return (
    <div className={`bg-slate-800/60 rounded-2xl p-3 flex items-center gap-3 mb-2 ios-card ${isDragTarget ? 'opacity-0' : ''}`}>
      {/* Drag handle */}
      <div {...dragHandleProps} style={{ touchAction: 'none' }}>
        <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>

      {/* Color indicator */}
      <div className={`w-1 h-10 rounded-full ${indicatorColor} transition-colors duration-300`} />

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate text-sm">
          {card.cardName || card.parallel || 'Card'}
        </p>
        <p className="text-slate-400 text-xs truncate">
          {card.cardNumber && `#${card.cardNumber}`} {card.serial && `• ${card.serial}`}
        </p>
        {hasInvestmentData && (
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-bold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {gain >= 0 ? '+' : ''}{formatCurrency(gain)} ({formatPercent(gainPercent)})
            </span>
            <span className="text-slate-500 text-xs">
              {formatCurrency(card.purchasePrice)} → {formatCurrency(card.currentValue)}
            </span>
          </div>
        )}
      </div>

      {/* Collected checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleCollected(card.id); }}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ios-press ${
          card.collected ? 'bg-orange-500 border-orange-500 ios-check-pop' : 'border-slate-500 hover:border-slate-400'
        }`}
      >
        {card.collected && (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Three dot menu */}
      <ThreeDotMenu>
        <MenuItem icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" label="Edit" onClick={() => onEdit(card)} />
        <MenuItem icon="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" label="Duplicate" onClick={() => onDuplicate(card)} />
        <MenuItem icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" label="Delete" onClick={() => onDelete(card.id)} danger />
      </ThreeDotMenu>
    </div>
  );
};

// ===== COLLECTION SECTION (CHANGE #2: ⋮ menu replaces pencil+trash) =====
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
  onDuplicateCollection,
  onReorderCards,
  dragHandleProps: collectionDragProps,
  isDragTarget: isCollectionDragTarget,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = COLLECTION_COLORS[collectionType] || COLLECTION_COLORS.flagship;
  const collected = cards.filter(c => c.collected).length;
  const total = cards.length;
  const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;

  const { containerRef, getDragHandleProps, dragIndex, placeholderIndex, isDragging } = useLongPressDrag({
    items: cards,
    onReorder: (reordered) => onReorderCards(setName, reordered),
    enabled: isExpanded,
  });

  const collectionGain = useMemo(() => {
    let totalGain = 0;
    cards.forEach(card => {
      if (card.purchasePrice && card.currentValue) {
        totalGain += calculateGain(card.purchasePrice, card.currentValue);
      }
    });
    return totalGain;
  }, [cards]);

  return (
    <div className={`mb-3 ${isCollectionDragTarget ? 'opacity-0' : ''}`}>
      {/* Collection Header */}
      <div
        className="bg-slate-800/60 ios-blur rounded-2xl p-3.5 flex items-center gap-3 ios-card cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Collection drag handle */}
        <div {...collectionDragProps} onClick={(e) => e.stopPropagation()} style={{ touchAction: 'none' }}>
          <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>

        <div className={`w-1.5 h-10 rounded-full ${colors.bg} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-semibold truncate">{setName}</p>
            {collectionGain !== 0 && (
              <span className={`text-xs font-bold ${collectionGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {collectionGain >= 0 ? '+' : ''}{formatCurrency(collectionGain)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-700 ease-out`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs font-medium">{percentage}%</span>
            <span className="text-slate-500 text-xs">({collected}/{total})</span>
          </div>
        </div>

        {/* Three-dot menu */}
        <ThreeDotMenu>
          <MenuItem
            icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            label="Edit Name"
            onClick={() => onEditCollection(setName)}
          />
          <MenuItem
            icon="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            label="Duplicate"
            onClick={() => onDuplicateCollection(setName)}
          />
          <MenuItem
            icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            label="Delete"
            onClick={() => onDeleteCollection(setName)}
            danger
          />
        </ThreeDotMenu>

        {/* Dropdown arrow */}
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ml-1 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Cards */}
      {isExpanded && (
        <div className="mt-2 ml-4 collection-cards-enter" ref={containerRef}>
          {cards.map((card, index) => (
            <React.Fragment key={card.id}>
              {isDragging && placeholderIndex === index && dragIndex !== index && (
                <div className="drag-placeholder mb-2" style={{ height: 52 }} />
              )}
              <div data-drag-index={index}>
                <CardItem
                  card={card}
                  onToggleCollected={onToggleCollected}
                  onEdit={onEditCard}
                  onDuplicate={onDuplicateCard}
                  onDelete={onDeleteCard}
                  collectionColor={colors}
                  dragHandleProps={getDragHandleProps(index)}
                  isDragTarget={dragIndex === index}
                />
              </div>
            </React.Fragment>
          ))}
          {isDragging && placeholderIndex >= cards.length && (
            <div className="drag-placeholder mb-2" style={{ height: 52 }} />
          )}
          {cards.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">No cards in this collection</p>
          )}
        </div>
      )}
    </div>
  );
};

// ===== DUPLICATE COLLECTION MODAL (CHANGE #1) =====
const DuplicateCollectionModal = ({ isOpen, onClose, collectionName, onDuplicate }) => {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (collectionName) setNewName(`${collectionName} (Copy)`);
  }, [collectionName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newName.trim()) {
      onDuplicate(collectionName, newName.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <h3 className="text-white text-lg font-bold mb-2">Duplicate Collection</h3>
          <p className="text-slate-400 text-sm mb-4">All cards from "<span className="text-white">{collectionName}</span>" will be copied to the new collection.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">New Collection Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Collection name"
                className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-medium ios-press">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-medium ios-press">
                Duplicate
              </button>
            </div>
          </form>
        </div>
      </div>
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
        notes: card.notes || '',
        purchasePrice: card.purchasePrice || '',
        purchaseDate: card.purchaseDate || '',
        currentValue: card.currentValue || ''
      });
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...card, ...formData });
    onClose();
  };
  
  const gain = calculateGain(formData.purchasePrice, formData.currentValue);
  const gainPercent = calculateGainPercent(formData.purchasePrice, formData.currentValue);
  const hasInvestmentData = formData.purchasePrice && formData.currentValue;

  const inputClass = "w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold">Edit Card</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center ios-press">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Card Name</label>
              <input type="text" value={formData.cardName} onChange={(e) => setFormData({ ...formData, cardName: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 text-sm mb-1">Card Number</label>
                <input type="text" value={formData.cardNumber} onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">Serial Number</label>
                <input type="text" value={formData.serial} onChange={(e) => setFormData({ ...formData, serial: e.target.value })} placeholder="e.g., /99" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Parallel/Variation</label>
              <input type="text" value={formData.parallel} onChange={(e) => setFormData({ ...formData, parallel: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Source</label>
              <input type="text" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} placeholder="e.g., Hobby, Retail" className={inputClass} />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className={`${inputClass} resize-none`} />
            </div>

            {/* Investment Section */}
            <div className="pt-2 border-t border-slate-700">
              <h4 className="text-orange-500 font-semibold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Investment Tracking
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Purchase Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input type="number" step="0.01" value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })} placeholder="0.00" className={`${inputClass} pl-7`} />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Purchase Date</label>
                  <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-slate-300 text-sm mb-1">Current Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input type="number" step="0.01" value={formData.currentValue} onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })} placeholder="0.00" className={`${inputClass} pl-7`} />
                </div>
                <p className="text-slate-500 text-xs mt-1">Update manually or link to market data</p>
              </div>

              {hasInvestmentData && (
                <div className={`mt-3 rounded-2xl p-3 border ${gain >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-xs">Total {gain >= 0 ? 'Gain' : 'Loss'}</p>
                      <p className={`font-bold text-xl ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs">ROI</p>
                      <div className="flex items-center gap-1">
                        <svg className={`w-4 h-4 ${gain >= 0 ? 'text-green-400' : 'text-red-400 rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        <p className={`font-bold text-xl ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercent(gainPercent)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-medium ios-press">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-medium ios-press">Save</button>
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <h3 className="text-white text-lg font-bold mb-4">Edit Collection</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
              autoFocus
            />
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-medium ios-press">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-medium ios-press">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ===== ADD COLLECTION MODAL =====
const AddCollectionModal = ({ isOpen, onClose, onAddCollection }) => {
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <h3 className="text-white text-lg font-bold mb-4">Add New Collection</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Collection Name</label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g., Base Card, 8-Bit Ballers"
                className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1">Collection Type</label>
              <select
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="flagship">Flagship</option>
                <option value="chrome">Chrome</option>
                <option value="holiday">Holiday</option>
                <option value="sapphire">Sapphire</option>
                <option value="midnight">Midnight</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-medium ios-press">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-medium ios-press">Add Collection</button>
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

  const inputClass = "bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold">Add Cards</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center ios-press">
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
                className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                {collections.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {cards.map((card, index) => (
                <div key={index} className="bg-slate-700/50 rounded-2xl p-3 space-y-2 ios-scale-in">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Card {index + 1}</span>
                    {cards.length > 1 && (
                      <button type="button" onClick={() => handleRemoveCard(index)} className="text-red-400 text-sm hover:text-red-300 ios-press">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Card Name" value={card.cardName} onChange={(e) => handleCardChange(index, 'cardName', e.target.value)} className={inputClass} />
                    <input type="text" placeholder="Card #" value={card.cardNumber} onChange={(e) => handleCardChange(index, 'cardNumber', e.target.value)} className={inputClass} />
                    <input type="text" placeholder="Parallel" value={card.parallel} onChange={(e) => handleCardChange(index, 'parallel', e.target.value)} className={inputClass} />
                    <input type="text" placeholder="Serial (e.g., /99)" value={card.serial} onChange={(e) => handleCardChange(index, 'serial', e.target.value)} className={inputClass} />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddAnother}
              className="w-full py-2 rounded-2xl border-2 border-dashed border-slate-600 text-slate-400 font-medium hover:border-orange-500 hover:text-orange-500 transition-colors ios-press"
            >
              + Add Another Card
            </button>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl bg-slate-700 text-slate-300 font-medium ios-press">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-medium ios-press">
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
const FilterSortModal = ({ isOpen, onClose, sortBy, setSortBy, collectionSortBy, setCollectionSortBy, filterCollected, setFilterCollected }) => {
  if (!isOpen) return null;

  const collectionSortOptions = [
    { value: 'default', label: 'Default' },
    { value: 'name-asc', label: 'A-Z' },
    { value: 'name-desc', label: 'Z-A' },
    { value: 'most-collected', label: 'Most Collected' },
    { value: 'least-collected', label: 'Least Collected' },
    { value: 'most-cards', label: 'Most Cards' },
    { value: 'least-cards', label: 'Least Cards' }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center ios-modal-backdrop" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto ios-modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
          <h3 className="text-white text-lg font-bold mb-4">Filter & Sort</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Sort Collections</label>
              <div className="grid grid-cols-2 gap-2">
                {collectionSortOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setCollectionSortBy(option.value)}
                    className={`py-2.5 px-3 rounded-2xl text-sm font-medium transition-all ios-press ${
                      collectionSortBy === option.value ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Sort Cards</label>
              <div className="grid grid-cols-2 gap-2">
                {['default', 'name', 'number', 'collected', 'custom'].map(option => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`py-2.5 px-3 rounded-2xl text-sm font-medium transition-all ios-press ${
                      sortBy === option ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm mb-2">Filter Cards</label>
              <div className="grid grid-cols-3 gap-2">
                {['all', 'collected', 'needed'].map(option => (
                  <button
                    key={option}
                    onClick={() => setFilterCollected(option)}
                    className={`py-2.5 px-3 rounded-2xl text-sm font-medium transition-all ios-press ${
                      filterCollected === option ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="w-full mt-4 py-3 rounded-2xl bg-slate-700 text-white font-medium ios-press">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== COLLECTIONS LIST WITH DRAG =====
const CollectionsList = ({
  filteredCollections,
  collectionTypes,
  onDeleteCard,
  onEditCard,
  onDuplicateCard,
  onToggleCollected,
  onEditCollection,
  onDeleteCollection,
  onDuplicateCollection,
  onReorderCards,
  onReorderCollections,
  onShowAddCollection,
}) => {
  const entries = useMemo(() =>
    Object.entries(filteredCollections).map(([name, cards]) => ({ name, cards })),
    [filteredCollections]
  );

  const { containerRef, getDragHandleProps, dragIndex, placeholderIndex, isDragging } = useLongPressDrag({
    items: entries,
    onReorder: onReorderCollections,
    enabled: entries.length > 1,
  });

  return (
    <div className="px-4" ref={containerRef}>
      {entries.map((entry, index) => (
        <React.Fragment key={entry.name}>
          {isDragging && placeholderIndex === index && dragIndex !== index && (
            <div className="drag-placeholder mb-3" style={{ height: 68 }} />
          )}
          <div data-drag-index={index}>
            <CollectionSection
              setName={entry.name}
              cards={entry.cards}
              collectionType={collectionTypes[entry.name]}
              onDeleteCard={onDeleteCard}
              onEditCard={onEditCard}
              onDuplicateCard={onDuplicateCard}
              onToggleCollected={onToggleCollected}
              onEditCollection={onEditCollection}
              onDeleteCollection={onDeleteCollection}
              onDuplicateCollection={onDuplicateCollection}
              onReorderCards={onReorderCards}
              dragHandleProps={getDragHandleProps(index)}
              isDragTarget={dragIndex === index}
            />
          </div>
        </React.Fragment>
      ))}
      {isDragging && placeholderIndex >= entries.length && (
        <div className="drag-placeholder mb-3" style={{ height: 68 }} />
      )}
      {entries.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No collections found</p>
          <button onClick={onShowAddCollection} className="mt-4 px-4 py-2 rounded-2xl bg-orange-500 text-white font-medium ios-press">
            Add Your First Collection
          </button>
        </div>
      )}
    </div>
  );
};

// ===== MAIN APP =====
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [customOrder, setCustomOrder] = useState({});
  const [hiddenCards, setHiddenCards] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [activeCollection, setActiveCollection] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [collectionSortBy, setCollectionSortBy] = useState('default');
  const [filterCollected, setFilterCollected] = useState('all');
  const [editingCard, setEditingCard] = useState(null);
  const [editingCollection, setEditingCollection] = useState(null);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [showAddCards, setShowAddCards] = useState(false);
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHiddenCards, setShowHiddenCards] = useState(false);
  const [duplicatingCollection, setDuplicatingCollection] = useState(null);

  const defaultCards = useMemo(() => flattenCardData(cardData), []);
  const initialLoadDone = useRef(false);
  const ignoreNextSnapshot = useRef(false);

  const saveToFirebase = useCallback(async (newCards, newCustomOrder = customOrder, newHiddenCards = hiddenCards) => {
    if (!user) return;
    setSyncing(true);
    setSaveError(false);
    ignoreNextSnapshot.current = true;
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

  const saveToFirebaseRef = useRef(saveToFirebase);
  useEffect(() => {
    saveToFirebaseRef.current = saveToFirebase;
  }, [saveToFirebase]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        initialLoadDone.current = false;
      }
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (ignoreNextSnapshot.current) {
        ignoreNextSnapshot.current = false;
        return;
      }
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedCards = ensureArray(data.cards);
        const loadedHidden = ensureArray(data.hiddenCards);
        if (loadedCards.length === 0 && !initialLoadDone.current && defaultCards.length > 0) {
          setCards(defaultCards);
          saveToFirebaseRef.current(defaultCards, {}, []);
        } else if (loadedCards.length > 0) {
          // Merge any new default cards not yet in user's data
          const existingIds = new Set(loadedCards.map(c => c.id));
          const hiddenIds = new Set(loadedHidden.map(c => c.id));
          const newCards = defaultCards.filter(c => !existingIds.has(c.id) && !hiddenIds.has(c.id));
          if (newCards.length > 0 && !initialLoadDone.current) {
            const merged = [...loadedCards, ...newCards];
            setCards(merged);
            saveToFirebaseRef.current(merged, data.customOrder || {}, loadedHidden);
          } else {
            setCards(loadedCards);
          }
        }
        const loadedCustomOrder = data.customOrder || {};
        setCustomOrder(loadedCustomOrder);
        setCollectionOrder(loadedCustomOrder.__collectionOrder || []);
        setHiddenCards(loadedHidden);
        initialLoadDone.current = true;
      } else {
        if (!initialLoadDone.current && defaultCards.length > 0) {
          setCards(defaultCards);
          saveToFirebaseRef.current(defaultCards, {}, []);
          initialLoadDone.current = true;
        }
      }
    });
    return () => unsubscribe();
  }, [user, defaultCards]);

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
      setCards([]);
      setCustomOrder({});
      setHiddenCards([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleToggleCollected = (cardId) => {
    const updated = cards.map(c => c.id === cardId ? { ...c, collected: !c.collected } : c);
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

  const handleEditCard = (card) => setEditingCard(card);

  const handleSaveCard = (updatedCard) => {
    const updated = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
    setCards(updated);
    saveToFirebase(updated);
    setEditingCard(null);
  };

  const handleDuplicateCard = (card) => {
    const newCard = { ...card, id: generateId(), collected: false };
    const updated = [...cards, newCard];
    setCards(updated);
    saveToFirebase(updated);
  };

  const handleEditCollection = (name) => setEditingCollection(name);

  const handleSaveCollection = (oldName, newName) => {
    const updated = cards.map(c => c.setName === oldName ? { ...c, setName: newName } : c);
    setCards(updated);
    saveToFirebase(updated);
    setEditingCollection(null);
  };

  const handleDeleteCollection = (name) => {
    const toDelete = cards.filter(c => c.setName === name);
    const updated = cards.filter(c => c.setName !== name);
    const newHidden = [...hiddenCards, ...toDelete];
    setCards(updated);
    setHiddenCards(newHidden);
    saveToFirebase(updated, customOrder, newHidden);
  };

  // CHANGE #1: Duplicate entire collection with new name
  const handleDuplicateCollection = (originalName, newName) => {
    const originalCards = cards.filter(c => c.setName === originalName);
    const duplicatedCards = originalCards.map(card => ({
      ...card,
      id: generateId(),
      setName: newName,
      collected: false,
      purchasePrice: null,
      purchaseDate: null,
      currentValue: null
    }));
    const updated = [...cards, ...duplicatedCards];
    setCards(updated);
    saveToFirebase(updated);
    setDuplicatingCollection(null);
  };

  const handleAddCollection = (name, type) => {
    const newCard = { 
      id: generateId(), 
      setName: name, 
      cardName: 'Base', 
      cardNumber: '', 
      parallel: '', 
      serial: '', 
      collected: false, 
      collectionType: type,
      purchasePrice: null,
      purchaseDate: null,
      currentValue: null
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
      collectionType,
      purchasePrice: null,
      purchaseDate: null,
      currentValue: null
    }));
    const updated = [...cards, ...cardsToAdd];
    setCards(updated);
    saveToFirebase(updated);
  };

  const handleReorderCards = useCallback((setName, reorderedCards) => {
    const newOrder = { ...customOrder, [setName]: reorderedCards.map(c => c.id) };
    setCustomOrder(newOrder);
    saveToFirebase(cards, newOrder);
  }, [customOrder, cards, saveToFirebase]);

  const [collectionOrder, setCollectionOrder] = useState([]);

  const handleReorderCollections = useCallback((reorderedEntries) => {
    const newOrder = reorderedEntries.map(e => e.name);
    setCollectionOrder(newOrder);
    const newCustomOrder = { ...customOrder, __collectionOrder: newOrder };
    setCustomOrder(newCustomOrder);
    saveToFirebase(cards, newCustomOrder);
  }, [customOrder, cards, saveToFirebase]);

  const handleRestoreCards = (cardIds) => {
    const cardsToRestore = hiddenCards.filter(c => cardIds.includes(c.id));
    const remainingHidden = hiddenCards.filter(c => !cardIds.includes(c.id));
    const updated = [...cards, ...cardsToRestore];
    setCards(updated);
    setHiddenCards(remainingHidden);
    saveToFirebase(updated, customOrder, remainingHidden);
  };

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
    const byType = { flagship: { collected: 0, total: 0 }, chrome: { collected: 0, total: 0 }, holiday: { collected: 0, total: 0 }, sapphire: { collected: 0, total: 0 }, midnight: { collected: 0, total: 0 } };
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
    if (activeCollection !== 'all') {
      result = Object.fromEntries(Object.entries(result).filter(([setName]) => collectionTypes[setName] === activeCollection));
    }
    if (filterCollected !== 'all') {
      Object.keys(result).forEach(setName => {
        result[setName] = result[setName].filter(card => filterCollected === 'collected' ? card.collected : !card.collected);
      });
      result = Object.fromEntries(Object.entries(result).filter(([_, cards]) => cards.length > 0));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      Object.keys(result).forEach(setName => {
        result[setName] = result[setName].filter(card => 
          (card.cardName || '').toLowerCase().includes(query) ||
          (card.setName || '').toLowerCase().includes(query) ||
          (card.parallel || '').toLowerCase().includes(query) ||
          (card.cardNumber || '').toLowerCase().includes(query) ||
          (card.serial || '').toLowerCase().includes(query)
        );
      });
      result = Object.fromEntries(Object.entries(result).filter(([_, cards]) => cards.length > 0));
    }
    Object.keys(result).forEach(setName => {
      const setCards = [...result[setName]];
      switch (sortBy) {
        case 'name': setCards.sort((a, b) => (a.cardName || '').localeCompare(b.cardName || '')); break;
        case 'number': setCards.sort((a, b) => (a.cardNumber || '').localeCompare(b.cardNumber || '', undefined, { numeric: true })); break;
        case 'collected': setCards.sort((a, b) => (b.collected ? 1 : 0) - (a.collected ? 1 : 0)); break;
        case 'custom':
        default:
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
    
    let sortedEntries = Object.entries(result);
    switch (collectionSortBy) {
      case 'name-asc': sortedEntries.sort((a, b) => a[0].localeCompare(b[0])); break;
      case 'name-desc': sortedEntries.sort((a, b) => b[0].localeCompare(a[0])); break;
      case 'most-collected': sortedEntries.sort((a, b) => b[1].filter(c => c.collected).length - a[1].filter(c => c.collected).length); break;
      case 'least-collected': sortedEntries.sort((a, b) => a[1].filter(c => c.collected).length - b[1].filter(c => c.collected).length); break;
      case 'most-cards': sortedEntries.sort((a, b) => b[1].length - a[1].length); break;
      case 'least-cards': sortedEntries.sort((a, b) => a[1].length - b[1].length); break;
      default:
        // Apply custom collection order
        if (collectionOrder.length > 0) {
          sortedEntries.sort((a, b) => {
            const aIdx = collectionOrder.indexOf(a[0]);
            const bIdx = collectionOrder.indexOf(b[0]);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          });
        }
        break;
    }

    return Object.fromEntries(sortedEntries);
  }, [collections, collectionTypes, activeCollection, filterCollected, searchQuery, sortBy, collectionSortBy, customOrder, collectionOrder]);

  const overallPercentage = stats.totalCards > 0 ? Math.round((stats.totalCollected / stats.totalCards) * 100) : 0;
  const collectedCards = useMemo(() => cards.filter(c => c.collected), [cards]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <IOSStyles />
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} loading={authLoading} />;

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      <IOSStyles />
      
      {/* Header */}
      <div className="bg-gradient-to-b from-orange-500/15 to-transparent px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white text-lg font-black tracking-tight">MyCardVault</span>
          <div className="flex items-center gap-2">
            {syncing && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
            {saveError && <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            {hiddenCards.length > 0 && (
              <button
                onClick={() => setShowHiddenCards(true)}
                className="relative w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center ios-press"
              >
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {hiddenCards.length}
                </span>
              </button>
            )}
            <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center ios-press">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="bg-slate-800/60 ios-blur rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-bold text-lg">Devin Booker</h2>
              <p className="text-slate-400 text-sm">2025-26 Topps Collection</p>
            </div>
            <div className="text-right">
              <p className="text-orange-500 font-bold text-3xl">{overallPercentage}%</p>
              <p className="text-slate-500 text-xs">{stats.totalCollected} of {stats.totalCards}</p>
            </div>
          </div>
          
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${overallPercentage}%` }} />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar">
            <button onClick={() => setActiveCollection('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ios-press ${activeCollection === 'all' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-700 text-slate-300'}`}>
              All ({overallPercentage}%)
            </button>
            {Object.entries(COLLECTION_COLORS).map(([type, config]) => {
              const typeStats = stats.byType[type] || { collected: 0, total: 0 };
              const pct = typeStats.total > 0 ? Math.round((typeStats.collected / typeStats.total) * 100) : 0;
              return (
                <button key={type} onClick={() => setActiveCollection(type)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ios-press ${activeCollection === type ? `${config.bg} text-white shadow-lg` : 'bg-slate-700 text-slate-300'}`}>
                  {config.label} ({pct}%)
                </button>
              );
            })}
          </div>
        </div>

        {/* Portfolio Value */}
        <PortfolioValueCard cards={collectedCards} />
      </div>

      {/* CHANGE #5: Search bar moved below Portfolio Value, above Top Performers */}
      <div className="px-4 pt-3">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="w-full bg-slate-800/60 ios-blur border border-slate-700/50 rounded-2xl pl-11 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center hover:bg-slate-500 ios-press"
            >
              <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Top Performers (colors removed) */}
      <TopPerformers cards={collectedCards} />

      {/* Action Buttons */}
      <div className="px-4 py-2 flex items-center gap-2">
        <button onClick={() => setShowAddCollection(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/60 text-slate-300 text-sm font-medium ios-press">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Collection
        </button>
        <button onClick={() => setShowAddCards(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/60 text-slate-300 text-sm font-medium ios-press">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Cards
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowFilterSort(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/60 text-slate-300 text-sm font-medium ios-press">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filter
        </button>
      </div>

      {/* Collections */}
      <CollectionsList
        filteredCollections={filteredCollections}
        collectionTypes={collectionTypes}
        onDeleteCard={handleDeleteCard}
        onEditCard={handleEditCard}
        onDuplicateCard={handleDuplicateCard}
        onToggleCollected={handleToggleCollected}
        onEditCollection={handleEditCollection}
        onDeleteCollection={handleDeleteCollection}
        onDuplicateCollection={(name) => setDuplicatingCollection(name)}
        onReorderCards={handleReorderCards}
        onReorderCollections={handleReorderCollections}
        onShowAddCollection={() => setShowAddCollection(true)}
      />

      {/* All Modals */}
      <EditCardModal isOpen={!!editingCard} onClose={() => setEditingCard(null)} card={editingCard} onSave={handleSaveCard} />
      <EditCollectionModal isOpen={!!editingCollection} onClose={() => setEditingCollection(null)} collectionName={editingCollection} onSave={handleSaveCollection} />
      <AddCollectionModal isOpen={showAddCollection} onClose={() => setShowAddCollection(false)} onAddCollection={handleAddCollection} />
      <AddCardsModal isOpen={showAddCards} onClose={() => setShowAddCards(false)} onAddCards={handleAddCards} collections={Object.keys(collections)} />
      <FilterSortModal isOpen={showFilterSort} onClose={() => setShowFilterSort(false)} sortBy={sortBy} setSortBy={setSortBy} collectionSortBy={collectionSortBy} setCollectionSortBy={setCollectionSortBy} filterCollected={filterCollected} setFilterCollected={setFilterCollected} />
      <HiddenCardsModal isOpen={showHiddenCards} onClose={() => setShowHiddenCards(false)} hiddenCards={hiddenCards} onRestore={handleRestoreCards} />
      <DuplicateCollectionModal 
        isOpen={!!duplicatingCollection} 
        onClose={() => setDuplicatingCollection(null)} 
        collectionName={duplicatingCollection} 
        onDuplicate={handleDuplicateCollection} 
      />
    </div>
  );
}
