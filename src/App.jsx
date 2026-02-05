import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
          // Investment fields
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

// ===== LOGIN SCREEN =====
const LoginScreen = ({ onLogin, loading }) => (
  <div className="min-h-screen bg-black relative overflow-hidden">
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
    <div className={`backdrop-blur rounded-2xl p-4 border-2 ${
      isPositive 
        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/30' 
        : 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border-red-500/30'
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

// ===== TOP PERFORMERS SECTION =====
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
        {performers.map((card, index) => {
          const isPositive = card.gain >= 0;
          const borderColor = index < 2 ? 'border-green-500' : 'border-red-500';
          const borderOpacity = index === 1 ? '/60' : '';
          
          return (
            <div key={card.id} className={`bg-slate-800 rounded-xl p-3 border-l-4 ${borderColor}${borderOpacity}`}>
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

// ===== THREE DOT MENU =====
const ThreeDotMenu = ({ onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => {
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
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-8 h-8 rounded-full hover:bg-slate-700 flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="19" r="2"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-slate-700 rounded-xl shadow-xl border border-slate-600 py-1 z-50 min-w-[140px]">
          {canMoveUp && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp(); setIsOpen(false); }}
              className="w-full px-4 py-2.5 text-left text-white hover:bg-slate-600 flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Move Up
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown(); setIsOpen(false); }}
              className="w-full px-4 py-2.5 text-left text-white hover:bg-slate-600 flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Move Down
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); setIsOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-white hover:bg-slate-600 flex items-center gap-3 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); setIsOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-white hover:bg-slate-600 flex items-center gap-3 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); setIsOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-slate-600 flex items-center gap-3 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ===== CARD ITEM =====
const CardItem = ({ 
  card, 
  onToggleCollected, 
  onEdit, 
  onDuplicate, 
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  collectionColor 
}) => {
  const gain = calculateGain(card.purchasePrice, card.currentValue);
  const gainPercent = calculateGainPercent(card.purchasePrice, card.currentValue);
  const hasInvestmentData = card.purchasePrice && card.currentValue;
  
  // Determine indicator color
  let indicatorColor = 'bg-slate-600';
  if (card.collected && hasInvestmentData) {
    indicatorColor = gain >= 0 ? 'bg-green-500' : 'bg-red-500';
  } else if (card.collected) {
    indicatorColor = collectionColor?.bg || 'bg-slate-600';
  }

  return (
    <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3 mb-2 transition-all duration-200 border-2 border-transparent">
      {/* Color indicator */}
      <div className={`w-1 h-10 rounded-full ${indicatorColor}`} />

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
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
          card.collected ? 'bg-orange-500 border-orange-500' : 'border-slate-500'
        }`}
      >
        {card.collected && (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Three dot menu */}
      <ThreeDotMenu
        onEdit={() => onEdit(card)}
        onDuplicate={() => onDuplicate(card)}
        onDelete={() => onDelete(card.id)}
        onMoveUp={() => onMoveUp(card)}
        onMoveDown={() => onMoveDown(card)}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
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
  onMoveCard
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = COLLECTION_COLORS[collectionType] || COLLECTION_COLORS.flagship;
  const collected = cards.filter(c => c.collected).length;
  const total = cards.length;
  const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
  
  // Calculate collection investment stats
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
    <div className="mb-4">
      {/* Collection Header */}
      <div 
        className="bg-slate-800/80 rounded-xl p-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`w-1.5 h-10 rounded-full ${colors.bg}`} />
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
                className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs font-medium">{percentage}%</span>
            <span className="text-slate-500 text-xs">({collected}/{total})</span>
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
          {cards.map((card, index) => (
            <CardItem
              key={card.id}
              card={card}
              onToggleCollected={onToggleCollected}
              onEdit={onEditCard}
              onDuplicate={onDuplicateCard}
              onDelete={onDeleteCard}
              onMoveUp={(c) => onMoveCard(c, 'up')}
              onMoveDown={(c) => onMoveCard(c, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < cards.length - 1}
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
            <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-slate-300 text-sm mb-1">Serial Number</label>
                <input
                  type="text"
                  value={formData.serial}
                  onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                  placeholder="e.g., /99"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
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
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-7 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-slate-300 text-sm mb-1">Current Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.currentValue}
                    onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-7 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <p className="text-slate-500 text-xs mt-1">Update manually or link to market data</p>
              </div>

              {/* Gain/Loss Display */}
              {hasInvestmentData && (
                <div className={`mt-3 rounded-xl p-3 border ${
                  gain >= 0 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
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
                placeholder="e.g., Base Card, 8-Bit Ballers"
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
  }, [isOpen]);

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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-white text-lg font-bold mb-4">Filter & Sort</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Sort Collections</label>
              <div className="grid grid-cols-2 gap-2">
                {collectionSortOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setCollectionSortBy(option.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      collectionSortBy === option.value ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
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
              <label className="block text-slate-300 text-sm mb-2">Filter Cards</label>
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

  const defaultCards = useMemo(() => flattenCardData(cardData), []);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedCards = ensureArray(data.cards);
        if (loadedCards.length === 0 && defaultCards.length > 0) {
          setCards(defaultCards);
          saveToFirebase(defaultCards, {}, []);
        } else {
          setCards(loadedCards);
        }
        setCustomOrder(data.customOrder || {});
        setHiddenCards(ensureArray(data.hiddenCards));
      } else {
        if (defaultCards.length > 0) {
          setCards(defaultCards);
          saveToFirebase(defaultCards, {}, []);
        }
      }
    });
    return () => unsubscribe();
  }, [user, defaultCards, saveToFirebase]);

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

  const handleMoveCard = (card, direction) => {
    const setName = card.setName;
    
    // Get cards in this set
    const cardsInSet = cards.filter(c => c.setName === setName);
    
    // If we already have a custom order, use it to sort; otherwise use current order
    let orderedSetCards = [...cardsInSet];
    if (customOrder[setName]) {
      const order = customOrder[setName];
      orderedSetCards.sort((a, b) => {
        const aIndex = order.indexOf(a.id);
        const bIndex = order.indexOf(b.id);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    }
    
    const currentIndex = orderedSetCards.findIndex(c => c.id === card.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= orderedSetCards.length) return;
    
    // Swap the cards
    const reordered = [...orderedSetCards];
    [reordered[currentIndex], reordered[newIndex]] = [reordered[newIndex], reordered[currentIndex]];
    
    // Save new order (just the order, not rebuilding the entire cards array)
    const newOrder = { ...customOrder, [setName]: reordered.map(c => c.id) };
    
    setCustomOrder(newOrder);
    saveToFirebase(cards, newOrder);
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
    // Search filter
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
          // Apply custom order if it exists (for both 'custom' and 'default')
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
    
    // Sort collections
    let sortedEntries = Object.entries(result);
    switch (collectionSortBy) {
      case 'name-asc':
        sortedEntries.sort((a, b) => a[0].localeCompare(b[0]));
        break;
      case 'name-desc':
        sortedEntries.sort((a, b) => b[0].localeCompare(a[0]));
        break;
      case 'most-collected':
        sortedEntries.sort((a, b) => {
          const aCollected = a[1].filter(c => c.collected).length;
          const bCollected = b[1].filter(c => c.collected).length;
          return bCollected - aCollected;
        });
        break;
      case 'least-collected':
        sortedEntries.sort((a, b) => {
          const aCollected = a[1].filter(c => c.collected).length;
          const bCollected = b[1].filter(c => c.collected).length;
          return aCollected - bCollected;
        });
        break;
      case 'most-cards':
        sortedEntries.sort((a, b) => b[1].length - a[1].length);
        break;
      case 'least-cards':
        sortedEntries.sort((a, b) => a[1].length - b[1].length);
        break;
      default:
        // Keep default order
        break;
    }
    
    return Object.fromEntries(sortedEntries);
  }, [collections, collectionTypes, activeCollection, filterCollected, searchQuery, sortBy, collectionSortBy, customOrder]);

  const overallPercentage = stats.totalCards > 0 ? Math.round((stats.totalCollected / stats.totalCards) * 100) : 0;
  
  // Get collected cards for investment tracking
  const collectedCards = useMemo(() => cards.filter(c => c.collected), [cards]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} loading={authLoading} />;

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      <div className="bg-gradient-to-b from-orange-500/20 to-transparent px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white text-lg font-black tracking-tight">MyCardVault</span>
          <div className="flex items-center gap-2">
            {syncing && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
            {saveError && <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-4 mb-3">
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
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" style={{ width: `${overallPercentage}%` }} />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button onClick={() => setActiveCollection('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeCollection === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
              All ({overallPercentage}%)
            </button>
            {Object.entries(COLLECTION_COLORS).map(([type, config]) => {
              const typeStats = stats.byType[type] || { collected: 0, total: 0 };
              const pct = typeStats.total > 0 ? Math.round((typeStats.collected / typeStats.total) * 100) : 0;
              return (
                <button key={type} onClick={() => setActiveCollection(type)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeCollection === type ? `${config.bg} text-white` : 'bg-slate-700 text-slate-300'}`}>
                  {config.label} ({pct}%)
                </button>
              );
            })}
          </div>
        </div>

        {/* Portfolio Value Card */}
        <PortfolioValueCard cards={collectedCards} />
      </div>

      {/* Top Performers */}
      <TopPerformers cards={collectedCards} />

      {/* Search Bar */}
      <div className="px-4 pt-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center hover:bg-slate-500"
            >
              <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 flex items-center gap-2">
        <button onClick={() => setShowAddCollection(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Collection
        </button>
        <button onClick={() => setShowAddCards(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Cards
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowFilterSort(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filter
        </button>
      </div>

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
            onMoveCard={handleMoveCard}
          />
        ))}
        {Object.keys(filteredCollections).length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No collections found</p>
            <button onClick={() => setShowAddCollection(true)} className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-white font-medium">
              Add Your First Collection
            </button>
          </div>
        )}
      </div>

      <EditCardModal isOpen={!!editingCard} onClose={() => setEditingCard(null)} card={editingCard} onSave={handleSaveCard} />
      <EditCollectionModal isOpen={!!editingCollection} onClose={() => setEditingCollection(null)} collectionName={editingCollection} onSave={handleSaveCollection} />
      <AddCollectionModal isOpen={showAddCollection} onClose={() => setShowAddCollection(false)} onAddCollection={handleAddCollection} />
      <AddCardsModal isOpen={showAddCards} onClose={() => setShowAddCards(false)} onAddCards={handleAddCards} collections={Object.keys(collections)} />
      <FilterSortModal isOpen={showFilterSort} onClose={() => setShowFilterSort(false)} sortBy={sortBy} setSortBy={setSortBy} collectionSortBy={collectionSortBy} setCollectionSortBy={setCollectionSortBy} filterCollected={filterCollected} setFilterCollected={setFilterCollected} />
    </div>
  );
}
