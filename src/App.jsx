import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import cardData from './data/bookerCards.json';

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
      return m ? parseInt(m[1]) : 9999;
    };
    return getSerialNum(b.serial) - getSerialNum(a.serial);
  });
};

// Coming Soon Modal
const ComingSoonModal = ({ feature, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 p-6 text-center">
      <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature === 'scan' ? "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" : "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
        </svg>
      </div>
      <h3 className="text-white text-xl font-bold mb-2">{feature === 'scan' ? 'Card Scanner' : 'Value Tracker'}</h3>
      <p className="text-slate-400 text-sm mb-4">
        {feature === 'scan' ? 'Snap a photo and let AI identify your card.' : 'Track real-time value with live market prices.'}
      </p>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4">
        <p className="text-amber-400 text-sm font-medium">🚀 Coming Soon</p>
      </div>
      <button onClick={onClose} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl">Got it</button>
    </div>
  </div>
);

// Card List Item with iOS-style Swipe-to-Delete
const CardListItem = ({ card, collected, hasImage, onToggle, onSelect, onDelete, onDuplicate }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const containerRef = useRef(null);
  const rarityColor = getRarityColor(card.serial);
  const DELETE_THRESHOLD = -75;

  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setSwipeX(Math.max(-100, Math.min(0, diff)));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < DELETE_THRESHOLD) {
      setIsDeleting(true);
      setTimeout(() => onDelete(card), 150);
    } else {
      setSwipeX(0);
    }
  };

  // Mouse support for desktop testing
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setStartX(e.clientX);
    setIsSwiping(true);
  };

  const handleMouseMove = (e) => {
    if (!isSwiping) return;
    const diff = e.clientX - startX;
    setSwipeX(Math.max(-100, Math.min(0, diff)));
  };

  const handleMouseUp = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    if (swipeX < DELETE_THRESHOLD) {
      setIsDeleting(true);
      setTimeout(() => onDelete(card), 150);
    } else {
      setSwipeX(0);
    }
  };

  const handleMouseLeave = () => {
    if (isSwiping) {
      setIsSwiping(false);
      setSwipeX(0);
    }
  };

  if (isDeleting) {
    return <div className="h-0 overflow-hidden transition-all duration-200 ease-out opacity-0" />;
  }

  return (
    <div className="relative overflow-hidden rounded-xl" ref={containerRef}>
      {/* Delete background - red with trash icon */}
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-end pr-4 rounded-r-xl">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
      
      {/* Swipeable card content */}
      <div 
        className={`relative flex items-center gap-3 p-3 border ${collected ? 'bg-slate-800 border-slate-600' : 'bg-slate-800 border-slate-700'} rounded-xl cursor-grab active:cursor-grabbing`}
        style={{ 
          transform: `translateX(${swipeX}px)`, 
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Color bar - matches rarity when collected */}
        <div className={`w-1.5 h-14 rounded-full ${collected ? rarityColor : 'bg-slate-600'} ${collected ? 'opacity-100' : 'opacity-40'}`} />
        
        <div 
          className="flex-1 min-w-0" 
          onClick={() => { if (swipeX === 0 && !isSwiping) onSelect(card); }}
        >
          <div className="flex items-center gap-2">
            <p className="text-white font-medium truncate">{card.parallel}</p>
            {collected && (
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-slate-400 text-sm truncate">
            #{card.cardNumber}
            {card.serial && <span className={`ml-2 font-medium ${getRarityTextColor(card.serial)}`}>{card.serial}</span>}
            {card.source && <span className="text-slate-500 ml-2">• {card.source}</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasImage && (
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          <button 
            onClick={(e) => { e.stopPropagation(); if (swipeX === 0) onToggle(card.id); }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${collected ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}
          >
            {collected ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); if (swipeX === 0) onDuplicate(card); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700"
            title="Duplicate card"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Collection Section with Swipe-to-Delete
const CollectionSection = ({ setKey, title, cardNumber, count, collected, cards, collection, onToggle, onSelect, onDelete, onDuplicate, onDeleteCollection, sortBy }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const progress = count > 0 ? Math.round((collected / count) * 100) : 0;
  const DELETE_THRESHOLD = -75;

  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX;
    setSwipeX(Math.max(-100, Math.min(0, diff)));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < DELETE_THRESHOLD) {
      setIsDeleting(true);
      setTimeout(() => onDeleteCollection(setKey), 150);
    } else {
      setSwipeX(0);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setStartX(e.clientX);
    setIsSwiping(true);
  };

  const handleMouseMove = (e) => {
    if (!isSwiping) return;
    const diff = e.clientX - startX;
    setSwipeX(Math.max(-100, Math.min(0, diff)));
  };

  const handleMouseUp = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    if (swipeX < DELETE_THRESHOLD) {
      setIsDeleting(true);
      setTimeout(() => onDeleteCollection(setKey), 150);
    } else {
      setSwipeX(0);
    }
  };

  const handleMouseLeave = () => {
    if (isSwiping) {
      setIsSwiping(false);
      setSwipeX(0);
    }
  };

  const sortedCards = useMemo(() => {
    let sorted = [...cards];
    switch (sortBy) {
      case 'rarity': return sortCardsByRarity(sorted);
      case 'collected': return sorted.sort((a, b) => (collection[b.id]?.collected ? 1 : 0) - (collection[a.id]?.collected ? 1 : 0));
      case 'missing': return sorted.sort((a, b) => (collection[a.id]?.collected ? 1 : 0) - (collection[b.id]?.collected ? 1 : 0));
      case 'alpha': return sorted.sort((a, b) => a.parallel.localeCompare(b.parallel));
      default: return sortCardsByRarity(sorted);
    }
  }, [cards, sortBy, collection]);

  if (isDeleting) {
    return <div className="h-0 overflow-hidden transition-all duration-200 ease-out opacity-0 mb-3" />;
  }

  return (
    <div className="mb-3">
      <div className="relative overflow-hidden rounded-xl">
        {/* Delete background */}
        <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-end pr-4 rounded-r-xl">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        {/* Swipeable header */}
        <div 
          className="relative flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700 cursor-grab active:cursor-grabbing"
          style={{ 
            transform: `translateX(${swipeX}px)`, 
            transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="flex items-center gap-2 flex-1"
            onClick={() => { if (swipeX === 0 && !isSwiping) setIsOpen(!isOpen); }}
          >
            <svg className={`w-4 h-4 text-orange-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
            <div className="text-left">
              <span className="text-white font-semibold text-sm">{title}</span>
              {cardNumber && <span className="text-slate-500 text-xs ml-2">#{cardNumber}</span>}
            </div>
            <span className="text-slate-500 text-xs bg-slate-700 px-2 py-0.5 rounded-full">{collected}/{count}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400 font-bold text-sm">{progress}%</span>
            <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all" style={{width: `${progress}%`}}/>
            </div>
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="mt-2 space-y-2">
          {sortedCards.map(card => (
            <CardListItem 
              key={card.id} 
              card={card} 
              collected={collection[card.id]?.collected} 
              hasImage={!!collection[card.id]?.image}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Card Detail Modal
const CardDetailModal = ({ card, collection, onClose, onUpdate, onToggle }) => {
  const [notes, setNotes] = useState(collection[card?.id]?.notes || '');
  const [serialNum, setSerialNum] = useState(collection[card?.id]?.serialNumber || '');
  const isCollected = collection[card?.id]?.collected;

  if (!card) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onUpdate(card.id, { image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-white font-bold text-lg">{card.setName}</h3>
            <p className="text-slate-400 text-sm">{card.parallel} {card.serial && <span className={getRarityTextColor(card.serial)}>{card.serial}</span>}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <button onClick={() => onToggle(card.id)} className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${isCollected ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {isCollected ? (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>In Collection</>
            ) : (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add to Collection</>
            )}
          </button>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Card Photo</label>
            {collection[card.id]?.image ? (
              <div className="relative">
                <img src={collection[card.id].image} alt={card.setName} className="w-full rounded-xl" />
                <button onClick={() => onUpdate(card.id, { image: null })} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-slate-500">
                <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-slate-500 text-sm">Tap to add photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          {card.serial && (
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Your Serial Number</label>
              <input type="text" value={serialNum} onChange={(e) => setSerialNum(e.target.value)} placeholder={`e.g., 42${card.serial}`} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
            </div>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purchase price, condition..." rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none" />
          </div>

          <button onClick={() => { onUpdate(card.id, { notes, serialNumber: serialNum }); onClose(); }} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

// Filter/Sort Modal
const FilterSortModal = ({ isOpen, onClose, sortBy, onSortChange, showCollectedOnly, onCollectedFilterChange, showMissingOnly, onMissingFilterChange }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-t-3xl border-t border-slate-700 p-6 pb-8">
        <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-6" />
        <h3 className="text-white text-lg font-bold mb-4">Sort & Filter</h3>
        
        <div className="mb-6">
          <p className="text-slate-400 text-sm font-medium mb-3">Sort By</p>
          <div className="grid grid-cols-2 gap-2">
            {[{key:'rarity',label:'Rarity (Base → 1/1)'},{key:'collected',label:'Collected First'},{key:'missing',label:'Missing First'},{key:'alpha',label:'Alphabetical'}].map(o => (
              <button key={o.key} onClick={() => onSortChange(o.key)} className={`px-4 py-3 rounded-xl text-sm font-medium ${sortBy === o.key ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{o.label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-slate-400 text-sm font-medium">Filter</p>
          <button onClick={() => { onCollectedFilterChange(!showCollectedOnly); if (!showCollectedOnly) onMissingFilterChange(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl ${showCollectedOnly ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700'}`}>
            <span className={showCollectedOnly ? 'text-green-400' : 'text-slate-300'}>Show Collected Only</span>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${showCollectedOnly ? 'bg-green-500' : 'bg-slate-600'}`}>
              {showCollectedOnly && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          </button>
          <button onClick={() => { onMissingFilterChange(!showMissingOnly); if (!showMissingOnly) onCollectedFilterChange(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl ${showMissingOnly ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-slate-700'}`}>
            <span className={showMissingOnly ? 'text-purple-400' : 'text-slate-300'}>Show Missing Only</span>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${showMissingOnly ? 'bg-purple-500' : 'bg-slate-600'}`}>
              {showMissingOnly && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          </button>
        </div>
        <button onClick={onClose} className="w-full mt-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl">Done</button>
      </div>
    </div>
  );
};

// Add Card Modal Component
const AddCardModal = ({ isOpen, onClose, onAddCard, existingSets, cardDataRef }) => {
  const [formData, setFormData] = useState({
    setKey: '',
    newSetName: '',
    setName: '',
    cardNumber: '',
    parallel: '',
    serial: '',
    source: ''
  });
  const [isNewSet, setIsNewSet] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setFormData({ setKey: '', newSetName: '', setName: '', cardNumber: '', parallel: '', serial: '', source: '' });
      setIsNewSet(false);
      setErrors({});
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!isNewSet && !formData.setKey) newErrors.setKey = 'Please select a set';
    if (isNewSet && !formData.newSetName.trim()) newErrors.newSetName = 'Set name is required';
    if (!formData.setName.trim()) newErrors.setName = 'Card set name is required';
    if (!formData.cardNumber.trim()) newErrors.cardNumber = 'Card number is required';
    if (!formData.parallel.trim()) newErrors.parallel = 'Parallel is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const determineCategory = (setName) => {
    const lower = setName.toLowerCase();
    if (lower.includes('chrome')) return 'chrome';
    if (lower.includes('holiday')) return 'holiday';
    return 'flagship';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const targetSetKey = isNewSet 
      ? formData.newSetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      : formData.setKey;

    const newCard = {
      id: `custom-${Date.now()}`,
      setName: formData.setName.trim(),
      cardNumber: formData.cardNumber.trim(),
      parallel: formData.parallel.trim(),
      serial: formData.serial.trim(),
      source: formData.source.trim()
    };

    const result = isNewSet 
      ? { card: newCard, isNewSet: true, setKey: targetSetKey, setMetadata: { name: formData.newSetName.trim(), category: determineCategory(formData.newSetName), cardNumber: formData.cardNumber.trim(), cards: [newCard] } }
      : { card: newCard, isNewSet: false, setKey: targetSetKey };

    onAddCard(result);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Add New Card</h2>
              <p className="text-slate-400 text-sm">Add a card to your checklist</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Product Set</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setIsNewSet(false)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${!isNewSet ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                Existing Set
              </button>
              <button type="button" onClick={() => setIsNewSet(true)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${isNewSet ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                New Set
              </button>
            </div>
            
            {!isNewSet ? (
              <select name="setKey" value={formData.setKey} onChange={handleChange} className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 ${errors.setKey ? 'border-red-500' : 'border-slate-600'}`}>
                <option value="">Select a set...</option>
                {existingSets.map(key => (
                  <option key={key} value={key}>{cardDataRef?.sets?.[key]?.name || key}</option>
                ))}
              </select>
            ) : (
              <input type="text" name="newSetName" value={formData.newSetName} onChange={handleChange} placeholder="e.g., Chrome - New Insert" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 ${errors.newSetName ? 'border-red-500' : 'border-slate-600'}`} />
            )}
            {(errors.setKey || errors.newSetName) && <p className="text-red-400 text-xs mt-1">{errors.setKey || errors.newSetName}</p>}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Card Set Name</label>
            <input type="text" name="setName" value={formData.setName} onChange={handleChange} placeholder="e.g., Base, Clutch Gene" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 ${errors.setName ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.setName && <p className="text-red-400 text-xs mt-1">{errors.setName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Card Number</label>
              <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleChange} placeholder="124" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 ${errors.cardNumber ? 'border-red-500' : 'border-slate-600'}`} />
              {errors.cardNumber && <p className="text-red-400 text-xs mt-1">{errors.cardNumber}</p>}
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Serial</label>
              <input type="text" name="serial" value={formData.serial} onChange={handleChange} placeholder="/99" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Parallel</label>
            <input type="text" name="parallel" value={formData.parallel} onChange={handleChange} placeholder="e.g., Base, Gold Rainbow" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 ${errors.parallel ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.parallel && <p className="text-red-400 text-xs mt-1">{errors.parallel}</p>}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Source (optional)</label>
            <input type="text" name="source" value={formData.source} onChange={handleChange} placeholder="e.g., Hobby exclusive, Retail" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600">Cancel</button>
            <button type="submit" className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600">Add Card</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Login Screen
const LoginScreen = ({ onLogin, loading }) => (
  <div className="min-h-screen bg-black relative overflow-hidden">
    <div className="absolute inset-0">
      <img src="/booker-jersey.jpg" alt="Devin Booker" className="w-full h-full object-cover" style={{ objectPosition: 'center 40%' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
    </div>
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="p-5"><span className="text-white text-xl font-black tracking-tight">MyCardVault</span></div>
      <div className="flex-1" />
      <div className="p-5 pb-8 space-y-5">
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight">Track Your<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Devin Booker</span><br />Cards</h1>
          <p className="text-slate-400 text-lg mt-3">The ultimate 2025-26 Topps collection tracker</p>
        </div>
        <div className="flex gap-5 text-sm">
          {['258 Cards', 'All Parallels', 'Free'].map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-300">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              <span>{f}</span>
            </div>
          ))}
        </div>
        <button onClick={onLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-4 px-6 rounded-2xl disabled:opacity-50 shadow-2xl">
          {loading ? <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" /> : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  </div>
);

// Main App
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [collection, setCollection] = useState({});
  const [customCards, setCustomCards] = useState({});
  const [hiddenCards, setHiddenCards] = useState({});
  const [hiddenSets, setHiddenSets] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showCollectedOnly, setShowCollectedOnly] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [activeTab, setActiveTab] = useState('collection');
  const [showComingSoon, setShowComingSoon] = useState(null);
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [sortBy, setSortBy] = useState('rarity');
  const pendingChangesRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
      if (!user) { setInitialLoadDone(false); setLastSavedData(null); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCollection(data.collection || {});
          setCustomCards(data.customCards || {});
          setHiddenCards(data.hiddenCards || {});
          setHiddenSets(data.hiddenSets || {});
          setLastSavedData(JSON.stringify({ 
            collection: data.collection || {}, 
            customCards: data.customCards || {},
            hiddenCards: data.hiddenCards || {},
            hiddenSets: data.hiddenSets || {}
          }));
        }
      } catch (error) { console.error('Error loading:', error); setSaveError('Failed to load. Please refresh.'); }
      setInitialLoadDone(true);
    };
    loadData();
  }, [user]);

  useEffect(() => {
    if (!user || !initialLoadDone) return;
    const currentData = JSON.stringify({ collection, customCards, hiddenCards, hiddenSets });
    if (currentData === lastSavedData) return;
    pendingChangesRef.current = true;
    
    const saveToFirestore = async () => {
      setSyncing(true); setSaveError(null);
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          collection, 
          customCards, 
          hiddenCards,
          hiddenSets,
          updatedAt: new Date().toISOString() 
        }, { merge: true });
        setLastSavedData(currentData);
        pendingChangesRef.current = false;
      } catch (error) {
        console.error('Save error:', error);
        setSaveError('Failed to save. Retrying...');
        setTimeout(async () => {
          try {
            await setDoc(doc(db, 'users', user.uid), { 
              collection, 
              customCards, 
              hiddenCards,
              hiddenSets,
              updatedAt: new Date().toISOString() 
            }, { merge: true });
            setLastSavedData(currentData);
            pendingChangesRef.current = false;
            setSaveError(null);
          } catch (e) { setSaveError('Save failed.'); }
        }, 2000);
      }
      setTimeout(() => setSyncing(false), 800);
    };
    const timeoutId = setTimeout(saveToFirestore, 1500);
    return () => clearTimeout(timeoutId);
  }, [collection, customCards, hiddenCards, hiddenSets, user, initialLoadDone, lastSavedData]);

  const handleLogin = async () => {
    setAuthLoading(true);
    try { await signInWithPopup(auth, googleProvider); } 
    catch (e) { console.error('Login error:', e); setAuthLoading(false); }
  };

  const handleLogout = async () => {
    if (pendingChangesRef.current && !window.confirm('Unsaved changes. Log out?')) return;
    try { await signOut(auth); setCollection({}); setCustomCards({}); setHiddenCards({}); setHiddenSets({}); } 
    catch (e) { console.error('Logout error:', e); }
  };

  // FIX: Chrome Greats -> Clutch Gene
  const mergedCardData = useMemo(() => {
    const fixed = JSON.parse(JSON.stringify(cardData));
    if (fixed.sets['chrome-chrome-greats']) {
      fixed.sets['chrome-clutch-gene'] = { ...fixed.sets['chrome-chrome-greats'], name: 'Chrome - Clutch Gene' };
      fixed.sets['chrome-clutch-gene'].cards = fixed.sets['chrome-chrome-greats'].cards.map(c => ({ ...c, setName: 'Clutch Gene' }));
      delete fixed.sets['chrome-chrome-greats'];
    }
    const merged = { ...fixed, sets: { ...fixed.sets } };
    Object.entries(customCards).forEach(([k, v]) => {
      if (merged.sets[k]) merged.sets[k] = { ...merged.sets[k], cards: [...merged.sets[k].cards, ...v.cards.filter(c => !merged.sets[k].cards.find(e => e.id === c.id))] };
      else merged.sets[k] = v;
    });
    return merged;
  }, [customCards]);

  // IMMEDIATE DELETE - no confirmation modal
  const handleDeleteCard = (card) => {
    // For custom cards (id starts with 'custom-'), remove from customCards
    if (card.id.startsWith('custom-')) {
      const setKey = Object.keys(mergedCardData.sets).find(k => 
        mergedCardData.sets[k].cards.some(c => c.id === card.id)
      );
      if (setKey) {
        setCustomCards(prev => {
          const existingSet = prev[setKey];
          if (!existingSet) return prev;
          const newCards = existingSet.cards.filter(c => c.id !== card.id);
          if (newCards.length === 0) {
            const { [setKey]: removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [setKey]: { ...existingSet, cards: newCards } };
        });
      }
    } else {
      // For base cards from JSON, add to hidden list
      setHiddenCards(prev => ({ ...prev, [card.id]: true }));
    }
    // Remove from collection if collected
    if (collection[card.id]) {
      setCollection(prev => { 
        const newCollection = { ...prev }; 
        delete newCollection[card.id]; 
        return newCollection; 
      });
    }
  };

  // IMMEDIATE DELETE COLLECTION - no confirmation modal  
  const handleDeleteCollection = (setKey) => {
    const set = mergedCardData.sets[setKey];
    if (!set) return;
    
    // Check if this is a custom set (all cards are custom)
    const isCustomSet = set.cards.every(c => c.id.startsWith('custom-'));
    
    if (isCustomSet) {
      // Remove the entire custom set
      setCustomCards(prev => {
        const { [setKey]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      // Hide the set (for base sets from JSON)
      setHiddenSets(prev => ({ ...prev, [setKey]: true }));
    }
    
    // Remove all cards from collection
    const cardIds = set.cards.map(c => c.id);
    setCollection(prev => {
      const newCollection = { ...prev };
      cardIds.forEach(id => delete newCollection[id]);
      return newCollection;
    });
  };

  const handleDuplicateCard = (card) => {
    const setKey = Object.keys(mergedCardData.sets).find(k => mergedCardData.sets[k].cards.some(c => c.id === card.id));
    if (setKey) {
      const newCard = { ...card, id: `custom-${Date.now()}`, parallel: `${card.parallel} (Copy)` };
      setCustomCards(prev => {
        const existingSet = prev[setKey] || { ...mergedCardData.sets[setKey], cards: [...mergedCardData.sets[setKey].cards] };
        return { ...prev, [setKey]: { ...existingSet, cards: [...existingSet.cards, newCard] } };
      });
    }
  };

  const handleAddCard = (result) => {
    if (result.isNewSet) {
      setCustomCards(prev => ({
        ...prev,
        [result.setKey]: result.setMetadata
      }));
    } else {
      setCustomCards(prev => ({
        ...prev,
        [result.setKey]: {
          ...prev[result.setKey],
          ...(mergedCardData.sets[result.setKey] || {}),
          cards: [
            ...(prev[result.setKey]?.cards || mergedCardData.sets[result.setKey]?.cards || []),
            result.card
          ]
        }
      }));
    }
  };

  const allCards = useMemo(() => {
    const cards = [];
    Object.entries(mergedCardData.sets).forEach(([setKey, set]) => {
      if (hiddenSets[setKey]) return; // Skip hidden sets
      set.cards.forEach(card => {
        if (!hiddenCards[card.id]) { // Skip hidden cards
          cards.push({ ...card, setKey, setName: card.setName || set.name, cardNumber: card.cardNumber || set.cardNumber, category: set.category });
        }
      });
    });
    return cards;
  }, [mergedCardData, hiddenCards, hiddenSets]);

  const filteredSets = useMemo(() => {
    const result = {};
    Object.entries(mergedCardData.sets).forEach(([setKey, set]) => {
      // Skip hidden sets
      if (hiddenSets[setKey]) return;
      
      let cards = set.cards
        .filter(c => !hiddenCards[c.id]) // Filter out hidden cards
        .map(c => ({ ...c, setKey, setName: c.setName || set.name, cardNumber: c.cardNumber || set.cardNumber, category: set.category }));
      
      if (activeFilter !== 'all' && set.category !== activeFilter) return;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        cards = cards.filter(c => c.parallel.toLowerCase().includes(q) || c.setName?.toLowerCase().includes(q) || c.source?.toLowerCase().includes(q) || c.serial?.toLowerCase().includes(q));
      }
      if (showMissingOnly) cards = cards.filter(c => !collection[c.id]?.collected);
      if (showCollectedOnly) cards = cards.filter(c => collection[c.id]?.collected);
      if (cards.length > 0) result[setKey] = { ...set, cards };
    });
    return result;
  }, [mergedCardData, activeFilter, searchQuery, showMissingOnly, showCollectedOnly, collection, hiddenCards, hiddenSets]);

  const stats = useMemo(() => {
    const total = allCards.length;
    const collected = allCards.filter(c => collection[c.id]?.collected).length;
    const byCategory = {};
    Object.entries(mergedCardData.sets).forEach(([setKey, set]) => {
      if (hiddenSets[setKey]) return;
      if (!byCategory[set.category]) byCategory[set.category] = { total: 0, collected: 0 };
      const visibleCards = set.cards.filter(c => !hiddenCards[c.id]);
      byCategory[set.category].total += visibleCards.length;
      byCategory[set.category].collected += visibleCards.filter(c => collection[c.id]?.collected).length;
    });
    return { total, collected, byCategory };
  }, [allCards, mergedCardData, collection, hiddenCards, hiddenSets]);

  const toggleCollected = (cardId) => setCollection(prev => ({ ...prev, [cardId]: { ...prev[cardId], collected: !prev[cardId]?.collected } }));
  const updateCard = (cardId, updates) => setCollection(prev => ({ ...prev, [cardId]: { ...prev[cardId], ...updates } }));
  const overallProgress = stats.total > 0 ? Math.round((stats.collected / stats.total) * 100) : 0;

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <LoginScreen onLogin={handleLogin} loading={authLoading} />;

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
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
        
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-bold text-lg">Devin Booker</h2>
              <p className="text-slate-400 text-sm">2025-26 Topps Collection</p>
            </div>
            <div className="text-right">
              <p className="text-orange-500 font-bold text-2xl">{stats.collected}</p>
              <p className="text-slate-500 text-xs">of {stats.total}</p>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="flex gap-4">
            {[{key:'flagship',label:'Flagship',color:'bg-orange-500'},{key:'chrome',label:'Chrome',color:'bg-blue-500'},{key:'holiday',label:'Holiday',color:'bg-green-500'}].map(cat => {
              const s = stats.byCategory[cat.key] || { total: 0, collected: 0 };
              const pct = s.total > 0 ? Math.round((s.collected / s.total) * 100) : 0;
              return <div key={cat.key} className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${cat.color}`} /><span className="text-slate-400 text-xs">{cat.label} {pct}%</span></div>;
            })}
          </div>
        </div>
      </div>

      {/* Swipe hint */}
      <div className="px-4 py-2">
        <p className="text-slate-500 text-xs text-center">← Swipe left on cards or collections to delete</p>
      </div>

      {/* Search + Filter */}
      <div className="px-4 py-2 flex gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search parallels..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
        </div>
        <button onClick={() => setShowFilterSort(true)} className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${(showMissingOnly || showCollectedOnly || sortBy !== 'rarity') ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          <span className="text-sm font-medium">Filter</span>
        </button>
      </div>

      {/* Category tabs */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
        {[{key:'all',label:'All Sets'},{key:'flagship',label:'Flagship'},{key:'chrome',label:'Chrome'},{key:'holiday',label:'Holiday'}].map(f => (
          <button key={f.key} onClick={() => setActiveFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${activeFilter === f.key ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{f.label}</button>
        ))}
      </div>

      {/* Card List */}
      <div className="px-4 pb-4">
        {Object.entries(filteredSets).map(([setKey, set]) => (
          <CollectionSection 
            key={setKey}
            setKey={setKey}
            title={set.name.replace(/^(Flagship|Chrome|Holiday) - /, '')}
            cardNumber={set.cardNumber}
            count={set.cards.length} 
            collected={set.cards.filter(c => collection[c.id]?.collected).length}
            cards={set.cards}
            collection={collection}
            onToggle={toggleCollected}
            onSelect={setSelectedCard}
            onDelete={handleDeleteCard}
            onDuplicate={handleDuplicateCard}
            onDeleteCollection={handleDeleteCollection}
            sortBy={sortBy}
          />
        ))}
      </div>

      {/* FAB for adding cards */}
      <button
        onClick={() => setShowAddCard(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all hover:scale-105 z-20"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 z-30">
        <div className="flex justify-around max-w-md mx-auto">
          {[
            { id: 'collection', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Cards' },
            { id: 'scan', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', label: 'Scan', premium: true },
            { id: 'value', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Value', premium: true },
            { id: 'profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Profile' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => tab.premium ? setShowComingSoon(tab.id) : setActiveTab(tab.id)}
              className={`flex flex-col items-center py-1.5 px-4 rounded-xl transition-all ${activeTab === tab.id ? 'text-orange-500 bg-orange-500/10' : 'text-slate-500'}`}
            >
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                {tab.premium && <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />}
              </div>
              <span className="text-xs mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {selectedCard && <CardDetailModal card={selectedCard} collection={collection} onClose={() => setSelectedCard(null)} onUpdate={updateCard} onToggle={toggleCollected} />}
      <AddCardModal isOpen={showAddCard} onClose={() => setShowAddCard(false)} onAddCard={handleAddCard} existingSets={Object.keys(mergedCardData.sets)} cardDataRef={mergedCardData} />
      <FilterSortModal isOpen={showFilterSort} onClose={() => setShowFilterSort(false)} sortBy={sortBy} onSortChange={setSortBy} showCollectedOnly={showCollectedOnly} onCollectedFilterChange={setShowCollectedOnly} showMissingOnly={showMissingOnly} onMissingFilterChange={setShowMissingOnly} />
      {showComingSoon && <ComingSoonModal feature={showComingSoon} onClose={() => setShowComingSoon(null)} />}
    </div>
  );
}
