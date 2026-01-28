import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import cardData from './data/bookerCards.json';

// Get rarity color based on serial number
const getRarityColor = (serial) => {
  if (!serial) return 'bg-slate-600';
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

// Coming Soon Modal Component
const ComingSoonModal = ({ feature, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 p-6 text-center">
      <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        {feature === 'scan' ? (
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <h3 className="text-white text-xl font-bold mb-2">
        {feature === 'scan' ? 'Card Scanner' : 'Value Tracker'}
      </h3>
      <p className="text-slate-400 text-sm mb-4">
        {feature === 'scan' 
          ? 'Snap a photo of any card and let AI automatically identify and add it to your collection.'
          : 'Track the real-time value of your collection with live market prices from eBay and PSA.'}
      </p>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4">
        <p className="text-amber-400 text-sm font-medium">🚀 Coming Soon</p>
        <p className="text-amber-400/70 text-xs mt-1">Premium feature in development</p>
      </div>
      <button
        onClick={onClose}
        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
      >
        Got it
      </button>
    </div>
  </div>
);

// Card Grid Item Component
const CardGridItem = ({ card, collected, hasImage, onToggle, onSelect }) => (
  <div 
    onClick={() => onSelect(card)}
    className={`aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center p-2 transition-all cursor-pointer ${
      collected 
        ? 'bg-slate-800 border-orange-500/50' 
        : 'bg-slate-800/30 border-slate-700 border-dashed hover:border-slate-600'
    }`}
  >
    {collected ? (
      <>
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center mb-1">
          {hasImage ? (
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <p className="text-white text-xs font-medium text-center leading-tight line-clamp-2">{card.parallel}</p>
        {card.serial && (
          <span className="text-orange-400 text-xs mt-0.5">{card.serial}</span>
        )}
      </>
    ) : (
      <>
        <div className={`w-10 h-10 rounded-full bg-opacity-20 flex items-center justify-center mb-1 ${getRarityColor(card.serial).replace('bg-', 'bg-')}/20`}>
          <div className={`w-3 h-3 rounded-full ${getRarityColor(card.serial)}`} />
        </div>
        <p className="text-slate-400 text-xs text-center leading-tight line-clamp-2">{card.parallel}</p>
        {card.serial && (
          <span className="text-slate-500 text-xs mt-0.5">{card.serial}</span>
        )}
      </>
    )}
  </div>
);

// Card List Item Component
const CardListItem = ({ card, collected, hasImage, onToggle, onSelect }) => (
  <div 
    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
      collected 
        ? 'bg-slate-800/80 border-orange-500/30' 
        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
    }`}
    onClick={() => onSelect(card)}
  >
    <div className={`w-1 h-12 rounded-full ${getRarityColor(card.serial)}`} />
    <div className="flex-1 min-w-0">
      <p className="text-white font-medium truncate">
        {card.setName} <span className="text-slate-500">#{card.cardNumber}</span>
      </p>
      <p className="text-slate-400 text-sm truncate">
        {card.parallel}
        {card.serial && <span className="text-orange-400 ml-2">{card.serial}</span>}
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
        onClick={(e) => { e.stopPropagation(); onToggle(card.id); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          collected 
            ? 'bg-orange-500 text-white' 
            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
        }`}
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
    </div>
  </div>
);

// Collapsible Section Component
const CollapsibleSection = ({ title, count, collected, defaultOpen = false, children, viewMode }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const progress = count > 0 ? Math.round((collected / count) * 100) : 0;
  
  return (
    <div className="mb-3">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 rounded-xl border border-slate-700 transition-all"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 text-orange-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-white font-semibold text-sm">{title}</span>
          <span className="text-slate-500 text-xs bg-slate-700 px-2 py-0.5 rounded-full">{collected}/{count}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-orange-400 font-bold text-sm">{progress}%</span>
          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{width: `${progress}%`}}/>
          </div>
        </div>
      </button>
      {isOpen && (
        <div className={`mt-2 ${viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-2'}`}>
          {children}
        </div>
      )}
    </div>
  );
};

// Card Detail Modal Component
const CardDetailModal = ({ card, collection, onClose, onUpdate, onToggle }) => {
  const [notes, setNotes] = useState(collection[card?.id]?.notes || '');
  const [serialNum, setSerialNum] = useState(collection[card?.id]?.serialNumber || '');
  const isCollected = collection[card?.id]?.collected;

  if (!card) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(card.id, { image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onUpdate(card.id, { notes, serialNumber: serialNum });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-white font-bold text-lg">{card.setName}</h3>
            <p className="text-slate-400 text-sm">{card.parallel} {card.serial && <span className="text-orange-400">{card.serial}</span>}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Collected Toggle */}
          <button
            onClick={() => onToggle(card.id)}
            className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              isCollected 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {isCollected ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                In Collection
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add to Collection
              </>
            )}
          </button>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Card Photo <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            {collection[card.id]?.image ? (
              <div className="relative">
                <img src={collection[card.id].image} alt={card.setName} className="w-full rounded-xl" />
                <button 
                  onClick={() => onUpdate(card.id, { image: null })}
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-slate-500 transition-colors">
                <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-500 text-sm">Tap to add photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          {card.serial && (
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Your Serial Number</label>
              <input
                type="text"
                value={serialNum}
                onChange={(e) => setSerialNum(e.target.value)}
                placeholder={`e.g., 42${card.serial}`}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Purchase price, condition, where acquired..."
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Card Number</span>
              <span className="text-white">{card.cardNumber}</span>
            </div>
            {card.source && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Source/Odds</span>
                <span className="text-white">{card.source}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Category</span>
              <span className="text-white capitalize">{card.category}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
          >
            Save Changes
          </button>
        </div>
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

  const generateId = (setKey) => {
    const prefix = setKey.substring(0, 2).toLowerCase();
    const existingCards = cardDataRef?.sets?.[setKey]?.cards || [];
    const maxNum = existingCards.reduce((max, card) => {
      const match = card.id.match(/-(\d+)$/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  };

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
      id: generateId(targetSetKey),
      setName: formData.setName.trim(),
      cardNumber: formData.cardNumber.trim(),
      parallel: formData.parallel.trim(),
      serial: formData.serial.trim(),
      source: formData.source.trim()
    };

    const result = isNewSet 
      ? { card: newCard, isNewSet: true, setKey: targetSetKey, setMetadata: { name: formData.newSetName.trim(), category: determineCategory(formData.newSetName), cards: [newCard] } }
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
              <select name="setKey" value={formData.setKey} onChange={handleChange} className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors ${errors.setKey ? 'border-red-500' : 'border-slate-600'}`}>
                <option value="">Select a set...</option>
                {existingSets.map(key => (
                  <option key={key} value={key}>{cardDataRef?.sets?.[key]?.name || key}</option>
                ))}
              </select>
            ) : (
              <input type="text" name="newSetName" value={formData.newSetName} onChange={handleChange} placeholder="e.g., Chrome Inserts" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.newSetName ? 'border-red-500' : 'border-slate-600'}`} />
            )}
            {(errors.setKey || errors.newSetName) && <p className="text-red-400 text-xs mt-1">{errors.setKey || errors.newSetName}</p>}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Card Set Name</label>
            <input type="text" name="setName" value={formData.setName} onChange={handleChange} placeholder="e.g., Base, Clutch Gene" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.setName ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.setName && <p className="text-red-400 text-xs mt-1">{errors.setName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Card Number</label>
              <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleChange} placeholder="124" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.cardNumber ? 'border-red-500' : 'border-slate-600'}`} />
              {errors.cardNumber && <p className="text-red-400 text-xs mt-1">{errors.cardNumber}</p>}
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Serial</label>
              <input type="text" name="serial" value={formData.serial} onChange={handleChange} placeholder="/99" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Parallel</label>
            <input type="text" name="parallel" value={formData.parallel} onChange={handleChange} placeholder="e.g., Base, Gold Rainbow" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.parallel ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.parallel && <p className="text-red-400 text-xs mt-1">{errors.parallel}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors">
              Add Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Login Screen Component
const LoginScreen = ({ onLogin, loading }) => (
  <div className="min-h-screen bg-black relative overflow-hidden">
    {/* Background Image - Booker positioned higher */}
    <div className="absolute inset-0">
      <img 
        src="/booker-hero.jpg" 
        alt="Devin Booker" 
        className="w-full h-full object-cover"
        style={{ objectPosition: 'center 20%' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
    </div>
    
    {/* Content */}
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* Logo Text at top - Bold + Tight */}
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
        
        {/* Features row */}
        <div className="flex gap-5 text-sm">
          {['258 Cards', 'All Parallels', 'Free'].map((f, i) => (
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
            <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
          ) : (
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [activeTab, setActiveTab] = useState('collection');
  const [showComingSoon, setShowComingSoon] = useState(null);
  
  const pendingChangesRef = useRef(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
      if (!user) {
        setInitialLoadDone(false);
        setLastSavedData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load data from Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCollection(data.collection || {});
          setCustomCards(data.customCards || {});
          setLastSavedData(JSON.stringify({ collection: data.collection || {}, customCards: data.customCards || {} }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setSaveError('Failed to load your collection. Please refresh.');
      }
      setInitialLoadDone(true);
    };

    loadData();
  }, [user]);

  // Save to Firestore with proper batching and error handling
  useEffect(() => {
    if (!user || !initialLoadDone) return;
    
    const currentData = JSON.stringify({ collection, customCards });
    
    if (currentData === lastSavedData) return;
    
    pendingChangesRef.current = true;
    
    const saveToFirestore = async () => {
      const dataToSave = { collection, customCards };
      const dataString = JSON.stringify(dataToSave);
      
      setSyncing(true);
      setSaveError(null);
      
      try {
        await setDoc(doc(db, 'users', user.uid), {
          ...dataToSave,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        setLastSavedData(dataString);
        pendingChangesRef.current = false;
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        setSaveError('Failed to save. Retrying...');
        
        setTimeout(async () => {
          try {
            await setDoc(doc(db, 'users', user.uid), {
              ...dataToSave,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            setLastSavedData(dataString);
            pendingChangesRef.current = false;
            setSaveError(null);
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            setSaveError('Save failed. Check connection.');
          }
        }, 2000);
      }
      
      setTimeout(() => setSyncing(false), 800);
    };

    const timeoutId = setTimeout(saveToFirestore, 1500);
    return () => clearTimeout(timeoutId);
  }, [collection, customCards, user, initialLoadDone]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pendingChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (pendingChangesRef.current) {
      const confirmLogout = window.confirm('You have unsaved changes. Are you sure you want to log out?');
      if (!confirmLogout) return;
    }
    
    try {
      await signOut(auth);
      setCollection({});
      setCustomCards({});
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Merge base card data with custom cards
  const mergedCardData = useMemo(() => {
    const merged = { ...cardData, sets: { ...cardData.sets } };
    Object.entries(customCards).forEach(([setKey, setData]) => {
      if (merged.sets[setKey]) {
        merged.sets[setKey] = {
          ...merged.sets[setKey],
          cards: [...merged.sets[setKey].cards, ...setData.cards.filter(c => !merged.sets[setKey].cards.find(ec => ec.id === c.id))]
        };
      } else {
        merged.sets[setKey] = setData;
      }
    });
    return merged;
  }, [customCards]);

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
            ...(prev[result.setKey]?.cards || []),
            result.card
          ]
        }
      }));
    }
  };

  const allCards = useMemo(() => {
    const cards = [];
    Object.entries(mergedCardData.sets).forEach(([setKey, set]) => {
      set.cards.forEach(card => cards.push({ ...card, setKey, setName: card.setName || set.name, cardNumber: card.cardNumber || set.cardNumber, category: set.category }));
    });
    return cards;
  }, [mergedCardData]);

  const filteredSets = useMemo(() => {
    const result = {};
    Object.entries(mergedCardData.sets).forEach(([setKey, set]) => {
      let cards = set.cards.map(card => ({ ...card, setKey, setName: card.setName || set.name, cardNumber: card.cardNumber || set.cardNumber, category: set.category }));
      if (activeFilter !== 'all' && set.category !== activeFilter) return;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        cards = cards.filter(c => c.parallel.toLowerCase().includes(q) || (c.setName?.toLowerCase().includes(q)) || (c.source?.toLowerCase().includes(q)) || (c.serial?.toLowerCase().includes(q)));
      }
      if (showMissingOnly) cards = cards.filter(c => !collection[c.id]?.collected);
      if (cards.length > 0) result[setKey] = { ...set, cards };
    });
    return result;
  }, [mergedCardData, activeFilter, searchQuery, showMissingOnly, collection]);

  const stats = useMemo(() => {
    const total = allCards.length;
    const collected = allCards.filter(c => collection[c.id]?.collected).length;
    const byCategory = {};
    Object.entries(mergedCardData.sets).forEach(([_, set]) => {
      if (!byCategory[set.category]) byCategory[set.category] = { total: 0, collected: 0 };
      byCategory[set.category].total += set.cards.length;
      byCategory[set.category].collected += set.cards.filter(c => collection[c.id]?.collected).length;
    });
    return { total, collected, byCategory };
  }, [allCards, mergedCardData, collection]);

  const toggleCollected = (cardId) => setCollection(prev => ({ ...prev, [cardId]: { ...prev[cardId], collected: !prev[cardId]?.collected } }));
  const updateCard = (cardId, updates) => setCollection(prev => ({ ...prev, [cardId]: { ...prev[cardId], ...updates } }));
  const overallProgress = stats.total > 0 ? Math.round((stats.collected / stats.total) * 100) : 0;

  // Handle bottom tab navigation
  const handleTabPress = (tab) => {
    if (tab === 'scan' || tab === 'value') {
      setShowComingSoon(tab);
    } else {
      setActiveTab(tab);
    }
  };

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login screen if not logged in
  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
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
        
        {/* Progress card */}
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
          
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500" 
              style={{ width: `${overallProgress}%` }} 
            />
          </div>
          
          {/* Category breakdown with percentages */}
          <div className="flex gap-4">
            {[
              { key: 'flagship', label: 'Flagship', color: 'bg-orange-500' },
              { key: 'chrome', label: 'Chrome', color: 'bg-blue-500' },
              { key: 'holiday', label: 'Holiday', color: 'bg-green-500' }
            ].map((cat) => {
              const catStats = stats.byCategory[cat.key] || { total: 0, collected: 0 };
              const pct = catStats.total > 0 ? Math.round((catStats.collected / catStats.total) * 100) : 0;
              return (
                <div key={cat.key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                  <span className="text-slate-400 text-xs">{cat.label} {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search + View Toggle */}
      <div className="px-4 py-3 flex gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search parallels..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
        {[
          { key: 'all', label: 'All Sets' },
          { key: 'flagship', label: 'Flagship' },
          { key: 'chrome', label: 'Chrome' },
          { key: 'holiday', label: 'Holiday' }
        ].map((f) => (
          <button 
            key={f.key}
            onClick={() => { setActiveFilter(f.key); setShowMissingOnly(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === f.key && !showMissingOnly
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button 
          onClick={() => setShowMissingOnly(!showMissingOnly)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            showMissingOnly
              ? 'bg-purple-500 text-white' 
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          Missing
        </button>
      </div>

      {/* Card List */}
      <div className="px-4 pb-4">
        {Object.entries(filteredSets).map(([setKey, set]) => (
          <CollapsibleSection 
            key={setKey} 
            title={set.name} 
            count={set.cards.length} 
            collected={set.cards.filter(c => collection[c.id]?.collected).length} 
            defaultOpen={setKey === 'flagship-base'}
            viewMode={viewMode}
          >
            {set.cards.map(card => (
              viewMode === 'grid' ? (
                <CardGridItem 
                  key={card.id} 
                  card={card} 
                  collected={collection[card.id]?.collected} 
                  hasImage={!!collection[card.id]?.image}
                  onToggle={toggleCollected}
                  onSelect={setSelectedCard}
                />
              ) : (
                <CardListItem 
                  key={card.id} 
                  card={card} 
                  collected={collection[card.id]?.collected} 
                  hasImage={!!collection[card.id]?.image}
                  onToggle={toggleCollected}
                  onSelect={setSelectedCard}
                />
              )
            ))}
          </CollapsibleSection>
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
            { id: 'collection', icon: 'cards', label: 'Cards' },
            { id: 'scan', icon: 'scan', label: 'Scan', premium: true },
            { id: 'value', icon: 'value', label: 'Value', premium: true },
            { id: 'profile', icon: 'profile', label: 'Profile' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => handleTabPress(tab.id)}
              className={`flex flex-col items-center py-1.5 px-4 rounded-xl transition-all ${
                activeTab === tab.id 
                  ? 'text-orange-500 bg-orange-500/10' 
                  : 'text-slate-500'
              }`}
            >
              <div className="relative">
                {tab.icon === 'cards' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )}
                {tab.icon === 'scan' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {tab.icon === 'value' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {tab.icon === 'profile' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                {tab.premium && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </div>
              <span className="text-xs mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal 
          card={selectedCard} 
          collection={collection} 
          onClose={() => setSelectedCard(null)} 
          onUpdate={updateCard}
          onToggle={toggleCollected}
        />
      )}

      {/* Add Card Modal */}
      <AddCardModal
        isOpen={showAddCard}
        onClose={() => setShowAddCard(false)}
        onAddCard={handleAddCard}
        existingSets={Object.keys(mergedCardData.sets)}
        cardDataRef={mergedCardData}
      />

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <ComingSoonModal 
          feature={showComingSoon} 
          onClose={() => setShowComingSoon(null)} 
        />
      )}
    </div>
  );
}
