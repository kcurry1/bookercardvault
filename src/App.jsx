import React, { useState, useEffect, useMemo } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
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

// Progress Ring Component
const ProgressRing = ({ progress, size = 56 }) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="#334155" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke="#f97316" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold text-sm">{progress}%</span>
      </div>
    </div>
  );
};

// Card Item Component
const CardItem = ({ card, collected, hasImage, onToggle, onSelect }) => (
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
const CollapsibleSection = ({ title, count, collected, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const progress = count > 0 ? Math.round((collected / count) * 100) : 0;
  
  return (
    <div className="mb-3">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-750 rounded-xl border border-slate-700 transition-all">
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 text-orange-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-white font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-orange-400 font-bold">{collected}<span className="text-slate-500 font-normal">/{count}</span></span>
          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{width: `${progress}%`}}/>
          </div>
        </div>
      </button>
      {isOpen && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
};

// Card Detail Modal Component
const CardDetailModal = ({ card, collection, onClose, onUpdate }) => {
  const [notes, setNotes] = useState(collection[card?.id]?.notes || '');
  const [serialNum, setSerialNum] = useState(collection[card?.id]?.serialNumber || '');

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
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
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
                <span className="text-slate-500 text-sm">Add photo (optional)</span>
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
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Add New Card</h2>
                <p className="text-slate-400 text-sm">Add a card to your checklist</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Card Set Name <span className="text-slate-500 font-normal">(e.g., Base, Clutch Gene)</span>
            </label>
            <input type="text" name="setName" value={formData.setName} onChange={handleChange} placeholder="Base" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.setName ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.setName && <p className="text-red-400 text-xs mt-1">{errors.setName}</p>}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Card Number <span className="text-slate-500 font-normal">(e.g., 124, CG-11)</span>
            </label>
            <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleChange} placeholder="124" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.cardNumber ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.cardNumber && <p className="text-red-400 text-xs mt-1">{errors.cardNumber}</p>}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Parallel <span className="text-slate-500 font-normal">(e.g., Base, Gold Rainbow)</span>
            </label>
            <input type="text" name="parallel" value={formData.parallel} onChange={handleChange} placeholder="Base" className={`w-full bg-slate-700 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors ${errors.parallel ? 'border-red-500' : 'border-slate-600'}`} />
            {errors.parallel && <p className="text-red-400 text-xs mt-1">{errors.parallel}</p>}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Serial / Numbered <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input type="text" name="serial" value={formData.serial} onChange={handleChange} placeholder="/99" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors" />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Source / Odds <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input type="text" name="source" value={formData.source} onChange={handleChange} placeholder="1:10" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors" />
          </div>

          {(formData.setName || formData.cardNumber || formData.parallel) && (
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600">
              <p className="text-slate-400 text-xs font-medium mb-2">PREVIEW</p>
              <div className="flex items-center gap-3">
                <div className={`w-1 h-12 rounded-full ${getRarityColor(formData.serial)}`} />
                <div>
                  <p className="text-white font-semibold">{formData.setName || 'Set Name'} #{formData.cardNumber || '000'}</p>
                  <p className="text-slate-400 text-sm">{formData.parallel || 'Parallel'}{formData.serial && <span className="text-orange-400 ml-2">{formData.serial}</span>}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
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
    {/* Background Image with Overlay */}
    <div className="absolute inset-0">
      <img 
        src="/booker-hero.jpg" 
        alt="Devin Booker" 
        className="w-full h-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 to-orange-900/30" />
    </div>
    
    {/* Content */}
    <div className="relative z-10 min-h-screen flex flex-col justify-end p-6 pb-12">
      {/* Logo/Branding at top */}
      <div className="absolute top-6 left-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <path strokeWidth={1.5} d="M12 3v18M3 12h18M5.5 5.5c3 3 3 10 0 13M18.5 5.5c-3 3-3 10 0 13" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">MyCardVault</span>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="space-y-6">
        {/* Title Section */}
        <div className="space-y-2">
          <p className="text-orange-400 font-semibold tracking-widest text-sm uppercase">Collection Tracker</p>
          <h1 className="text-white text-4xl sm:text-5xl font-bold leading-tight">
            Track Your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Devin Booker</span><br />
            Cards
          </h1>
          <p className="text-slate-300 text-lg max-w-sm">
            The ultimate 2025-26 Topps collection tracker. Never lose track of your cards again.
          </p>
        </div>
        
        {/* Features */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Cloud Sync</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>223+ Cards</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Free</span>
          </div>
        </div>
        
        {/* Sign In Button */}
        <button
          onClick={onLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 shadow-2xl shadow-white/10"
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
        
        {/* Footer */}
        <p className="text-slate-500 text-xs text-center">
          By signing in, you agree to sync your collection data securely
        </p>
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

  // Load data from Firestore when user logs in (one-time load)
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCollection(data.collection || {});
        setCustomCards(data.customCards || {});
        setLastSavedData(JSON.stringify({ collection: data.collection || {}, customCards: data.customCards || {} }));
      }
      setInitialLoadDone(true);
    };

    loadData();
  }, [user]);

  // Save to Firestore only when data actually changes (after initial load)
  useEffect(() => {
    if (!user || !initialLoadDone) return;
    
    const currentData = JSON.stringify({ collection, customCards });
    
    // Don't save if data hasn't changed
    if (currentData === lastSavedData) return;
    
    const saveToFirestore = async () => {
      setSyncing(true);
      try {
        await setDoc(doc(db, 'users', user.uid), {
          collection,
          customCards,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setLastSavedData(currentData);
      } catch (error) {
        console.error('Error saving to Firestore:', error);
      }
      // Hide syncing indicator after a brief moment
      setTimeout(() => setSyncing(false), 800);
    };

    const timeoutId = setTimeout(saveToFirestore, 500); // Debounce saves
    return () => clearTimeout(timeoutId);
  }, [collection, customCards, user, initialLoadDone, lastSavedData]);

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
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
            <div>
              <h1 className="text-white font-bold text-lg">Devin Booker</h1>
              <p className="text-slate-400 text-xs">2025-26 Topps Collection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {syncing && (
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            )}
            <ProgressRing progress={overallProgress} size={48}/>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: stats.collected, max: stats.total },
          { label: 'Flagship', value: stats.byCategory.flagship?.collected || 0, max: stats.byCategory.flagship?.total || 0 },
          { label: 'Chrome', value: stats.byCategory.chrome?.collected || 0, max: stats.byCategory.chrome?.total || 0 }
        ].map((s, i) => (
          <div key={i} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <p className="text-slate-400 text-xs font-medium">{s.label}</p>
            <p className="text-white font-bold text-xl mt-1">{s.value}<span className="text-slate-500 text-sm font-normal">/{s.max}</span></p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search cards..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"/>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
        {[
          { k: 'all', l: 'All' },
          { k: 'flagship', l: 'Flagship' },
          { k: 'chrome', l: 'Chrome' },
          { k: 'holiday', l: 'Holiday' }
        ].map(f => (
          <button key={f.k} onClick={() => setActiveFilter(f.k)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeFilter === f.k ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {f.l}
          </button>
        ))}
        <button onClick={() => setShowMissingOnly(!showMissingOnly)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${showMissingOnly ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
          Missing Only
        </button>
      </div>

      {/* Card List */}
      <div className="px-4 pb-24">
        {Object.entries(filteredSets).map(([setKey, set]) => (
          <CollapsibleSection key={setKey} title={set.name} count={set.cards.length} collected={set.cards.filter(c => collection[c.id]?.collected).length} defaultOpen={setKey === 'flagship-base'}>
            {set.cards.map(card => (
              <CardItem 
                key={card.id} 
                card={card} 
                collected={collection[card.id]?.collected} 
                hasImage={!!collection[card.id]?.image}
                onToggle={toggleCollected}
                onSelect={setSelectedCard}
              />
            ))}
          </CollapsibleSection>
        ))}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddCard(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all hover:scale-110 z-30"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal 
          card={selectedCard} 
          collection={collection} 
          onClose={() => setSelectedCard(null)} 
          onUpdate={updateCard}
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
    </div>
  );
}
