const CacheManager = {
    PREFS_KEY_PREFIX: 'userPreferences_',
    ROUTINES_KEY_PREFIX: 'cachedRoutines_',
    SHARED_ROUTINES_KEY_PREFIX: 'cachedSharedRoutines_',

    GLOBAL_THEME_KEY: 'globalThemePrefs',
    
    // Cache configuration
    CACHE_VERSION: '1.0.0',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    MAX_CACHE_ITEMS: 50,
    
    // Loading state tracking
    _loadingStates: new Map(),
    
    // LRU tracking for quota management
    _lruTracker: new Map(),

    // Safe localStorage wrapper with quota management
    safeSetItem: function(key, value) {
        try {
            localStorage.setItem(key, value);
            this._updateLRU(key);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded, attempting cleanup...');
                if (this._performLRUCleanup()) {
                    try {
                        localStorage.setItem(key, value);
                        this._updateLRU(key);
                        console.log('Cleanup successful, item saved');
                        return true;
                    } catch (retryError) {
                        console.error('Retry failed after cleanup:', retryError);
                    }
                }
            }
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    },
    
    // Safe localStorage getter with validation
    safeGetItem: function(key) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return null;
            
            // Validate JSON structure
            const parsed = JSON.parse(value);
            this._updateLRU(key);
            return parsed;
        } catch (error) {
            console.warn('Corrupted data in localStorage, removing key:', key, error);
            try {
                localStorage.removeItem(key);
                this._lruTracker.delete(key);
            } catch (removeError) {
                console.error('Failed to remove corrupted key:', removeError);
            }
            return null;
        }
    },
    
    // LRU management
    _updateLRU: function(key) {
        this._lruTracker.set(key, Date.now());
    },
    
    _performLRUCleanup: function() {
        const cacheKeys = Array.from(this._lruTracker.keys())
            .filter(key => key.startsWith(this.ROUTINES_KEY_PREFIX) || key.startsWith(this.SHARED_ROUTINES_KEY_PREFIX))
            .sort((a, b) => this._lruTracker.get(a) - this._lruTracker.get(b));
        
        if (cacheKeys.length === 0) {
            console.warn('No cache items to clean up');
            return false;
        }
        
        // Remove oldest 25% of cache items
        const itemsToRemove = Math.max(1, Math.floor(cacheKeys.length * 0.25));
        let removed = 0;
        
        for (let i = 0; i < itemsToRemove && i < cacheKeys.length; i++) {
            try {
                localStorage.removeItem(cacheKeys[i]);
                this._lruTracker.delete(cacheKeys[i]);
                removed++;
                console.log('Removed old cache item:', cacheKeys[i]);
            } catch (error) {
                console.error('Failed to remove cache item:', cacheKeys[i], error);
            }
        }
        
        console.log(`LRU Cleanup: removed ${removed}/${itemsToRemove} items`);
        return removed > 0;
    },
    
    // Standardized cache format
    _createCacheEntry: function(data) {
        return {
            data: data,
            timestamp: Date.now(),
            version: this.CACHE_VERSION
        };
    },
    
    _validateCacheEntry: function(entry) {
        return entry && 
               typeof entry === 'object' && 
               entry.data !== undefined && 
               typeof entry.timestamp === 'number' &&
               entry.version === this.CACHE_VERSION;
    },
    
    // Loading state management
    _setLoadingState: function(key, isLoading) {
        if (isLoading) {
            this._loadingStates.set(key, Date.now());
        } else {
            this._loadingStates.delete(key);
        }
    },
    
    _isLoading: function(key) {
        const loadingTime = this._loadingStates.get(key);
        if (!loadingTime) return false;
        
        // Auto-clear loading states older than 30 seconds
        if (Date.now() - loadingTime > 30000) {
            this._loadingStates.delete(key);
            return false;
        }
        
        return true;
    },
    
    // Helper to revive Firestore timestamps or date strings
    _reviveDates: function(routines) {
        return routines.map(r => {
            // Helper to convert a value to a firestore-like timestamp object
            const toTimestamp = (val) => {
                if (!val) return null;
                if (typeof val === 'string') {
                    const date = new Date(val);
                    return {
                        toDate: () => date,
                        seconds: Math.floor(date.getTime() / 1000)
                    };
                }
                if (val.seconds) {
                    const date = new Date(val.seconds * 1000);
                    return {
                        toDate: () => date,
                        seconds: val.seconds
                    };
                }
                return val; // Already an object or unknown
            };

            if (r.createdAt) r.createdAt = toTimestamp(r.createdAt);
            if (r.startDate) r.startDate = toTimestamp(r.startDate);
            if (r.endDate) r.endDate = toTimestamp(r.endDate);
            
            return r;
        });
    },

    saveGlobalTheme: function(prefs) {
        if (prefs && prefs.color) {
            localStorage.setItem(this.GLOBAL_THEME_KEY, JSON.stringify(prefs));
        }
    },

    loadGlobalTheme: function() {
        const cached = localStorage.getItem(this.GLOBAL_THEME_KEY);
        return cached ? JSON.parse(cached) : null;
    },

    applyGlobalTheme: function() {
        const prefs = this.loadGlobalTheme();
        if (prefs && prefs.color) {
            // Same logic as setPrimaryColor in other files
            const colorMap = {
                'Arancione': '#ff6600',
                'Verde': '#4ade80',
                'Blu': '#3b82f6',
                'Rosa': '#f472b6'
            };
            const gradientMap = {
                'Arancione': 'linear-gradient(135deg, #2b1d16 0%, #1a1a1a 100%)',
                'Verde': 'linear-gradient(135deg, #1a2b16 0%, #1a1a1a 100%)',
                'Blu': 'linear-gradient(135deg, #161d2b 0%, #1a1a1a 100%)',
                'Rosa': 'linear-gradient(135deg, #2b1625 0%, #1a1a1a 100%)'
            };
            
            const colorName = prefs.color;
            const hex = colorMap[colorName] || colorMap['Arancione'];
            const gradient = gradientMap[colorName] || gradientMap['Arancione'];
            
            // Convert hex to rgb for opacity usage
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const rgb = `${r}, ${g}, ${b}`;

            document.documentElement.style.setProperty('--primary-color', hex);
            document.documentElement.style.setProperty('--primary-color-rgb', rgb);
            document.documentElement.style.setProperty('--background-gradient', gradient);
        }
    },

    savePreferences: function(uid, prefs) {
        const key = this.PREFS_KEY_PREFIX + uid;
        const success = this.safeSetItem(key, JSON.stringify(prefs));
        if (success) {
            this.saveGlobalTheme(prefs); // Also save globally
            window.dispatchEvent(new CustomEvent('preferencesUpdated', { detail: prefs }));
        }
        return success;
    },

    getPreferences: function(uid) {
        const key = this.PREFS_KEY_PREFIX + uid;
        const cached = this.safeGetItem(key);
        return cached;
    },

    saveRoutines: function(uid, routines) {
        const key = this.ROUTINES_KEY_PREFIX + uid;
        
        // Sort before saving
        routines.sort((a, b) => {
            const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        // Store dates as simple objects or strings that can be serialized
        const toSave = routines.map(r => {
            const copy = { ...r };
            if (copy.createdAt && copy.createdAt.toDate) {
                copy.createdAt = copy.createdAt.toDate().toISOString();
            }
            if (copy.startDate && copy.startDate.toDate) {
                copy.startDate = copy.startDate.toDate().toISOString();
            }
            if (copy.endDate && copy.endDate.toDate) {
                copy.endDate = copy.endDate.toDate().toISOString();
            }
            return copy;
        });

        const cacheEntry = this._createCacheEntry(toSave);
        const success = this.safeSetItem(key, JSON.stringify(cacheEntry));
        
        if (success) {
            // Dispatch event if needed
            window.dispatchEvent(new CustomEvent('routinesUpdated', { detail: routines }));
        }
        
        return success;
    },

    getRoutines: function(uid) {
        const key = this.ROUTINES_KEY_PREFIX + uid;
        const cacheEntry = this.safeGetItem(key);
        
        if (!cacheEntry || !this._validateCacheEntry(cacheEntry)) {
            return null;
        }
        
        try {
            return this._reviveDates(cacheEntry.data);
        } catch (e) {
            console.error("Error parsing cached routines:", e);
            // Remove corrupted entry
            try {
                localStorage.removeItem(key);
                this._lruTracker.delete(key);
            } catch (removeError) {
                console.error('Failed to remove corrupted routines cache:', removeError);
            }
            return null;
        }
    },

    updateRoutine: function(uid, routine) {
        let routines = this.getRoutines(uid) || [];
        const index = routines.findIndex(r => r.id === routine.id);
        
        // Ensure routine has a proper date format for saving
        if (routine.createdAt && routine.createdAt.toDate) {
             // It's already good for in-memory, but saveRoutines handles conversion
        }

        if (index !== -1) {
            routines[index] = routine;
        } else {
            routines.unshift(routine);
        }
        
        // Keep only top 5 if we want to strictly follow "cache top 5" requirement for size?
        // User said "nella cache devono essere presenti... le prime 5". It doesn't strictly forbid more.
        // But to be safe and consistent, we update the list.
        this.saveRoutines(uid, routines);
    },

    initCache: async function(uid, force = false) {
        console.log('Initializing cache for user:', uid, 'Force:', force);
        const db = firebase.firestore();
        
        // 1. Preferences
        if (force || !this.getPreferences(uid)) {
            try {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    if (data.preferences) {
                        this.savePreferences(uid, data.preferences);
                        console.log('Preferences cached');
                    }
                }
            } catch (e) {
                console.error("Error caching preferences:", e);
            }
        } else {
            console.log('Preferences loaded from cache');
        }

        // 2. Routines (Top 20)
        if (force || !this.getRoutines(uid)) {
            try {
                const routinesSnapshot = await db.collection('routines')
                    .where('userId', '==', uid)
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();

                const routines = [];
                routinesSnapshot.forEach(doc => {
                     routines.push({ id: doc.id, ...doc.data() });
                });
                
                this.saveRoutines(uid, routines);
                console.log('Top 20 routines cached');
            } catch (e) {
                console.error("Error caching routines:", e);
            }
        } else {
            console.log('Routines loaded from cache');
        }
    },

    // Funzioni helper per compatibilità
    getLocalRoutinesCache: function(uid) {
        return this.getRoutines(uid);
    },

    updateLocalRoutinesCache: function(uid, routines) {
        this.saveRoutines(uid, routines);
    },

    // Aggiorna una singola routine nella cache
    updateSingleRoutineInCache: function(uid, routine) {
        let routines = this.getRoutines(uid) || [];
        const index = routines.findIndex(r => r.id === routine.id);
        
        if (index !== -1) {
            // Aggiorna la routine esistente
            routines[index] = routine;
        } else {
            // Aggiungi la nuova routine all'inizio
            routines.unshift(routine);
        }
        
        // Mantiene solo le prime 20
        routines = routines.slice(0, 20);
        this.saveRoutines(uid, routines);
        console.log('Single routine updated in cache:', routine.id);
    },

    // Rimuovi una routine dalla cache (with proper error handling)
    removeRoutineFromCache: function(uid, routineId) {
        let routines = this.getRoutines(uid) || [];
        routines = routines.filter(r => r.id !== routineId);
        this.saveRoutines(uid, routines);
        console.log('Routine removed from cache:', routineId);
    },

    // Forza l'aggiornamento della cache delle schede possedute
    forceRefreshRoutines: function(uid) {
        const key = this.ROUTINES_KEY_PREFIX + uid;
        try {
            localStorage.removeItem(key);
            this._lruTracker.delete(key);
        } catch (error) {
            console.error('Failed to remove routines cache:', error);
        }
        console.log('Forced refresh of routines cache for user:', uid);
    },

    // SHARED ROUTINES CACHE METHODS

    // Salva le schede condivise nella cache (standardized format)
    saveSharedRoutines: function(uid, sharedRoutines) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        
        // Remove duplicates before saving
        const uniqueRoutines = [];
        const seenIds = new Set();
        
        for (const routine of sharedRoutines) {
            if (!seenIds.has(routine.id)) {
                seenIds.add(routine.id);
                uniqueRoutines.push(routine);
            }
        }
        
        // Store dates as simple objects or strings that can be serialized
        const toSave = uniqueRoutines.map(r => {
            const copy = { ...r };
            if (copy.createdAt && copy.createdAt.toDate) {
                copy.createdAt = copy.createdAt.toDate().toISOString();
            }
            if (copy.startDate && copy.startDate.toDate) {
                copy.startDate = copy.startDate.toDate().toISOString();
            }
            if (copy.endDate && copy.endDate.toDate) {
                copy.endDate = copy.endDate.toDate().toISOString();
            }
            return copy;
        });
        
        const cacheEntry = this._createCacheEntry(toSave);
        const success = this.safeSetItem(key, JSON.stringify(cacheEntry));
        
        if (success) {
            console.log('Shared routines cached for user:', uid, 'Count:', uniqueRoutines.length);
        }
        
        return success;
    },

    // Ottieni le schede condivise dalla cache (standardized format)
    getSharedRoutines: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        const cacheEntry = this.safeGetItem(key);
        
        if (!cacheEntry || !this._validateCacheEntry(cacheEntry)) {
            return null;
        }
        
        try {
            console.log('Shared routines loaded from cache for user:', uid, 'Count:', cacheEntry.data.length);
            return this._reviveDates(cacheEntry.data);
        } catch (error) {
            console.warn('Failed to load shared routines from cache:', error);
            // Remove corrupted entry
            try {
                localStorage.removeItem(key);
                this._lruTracker.delete(key);
            } catch (removeError) {
                console.error('Failed to remove corrupted shared routines cache:', removeError);
            }
            return null;
        }
    },

    // Ottieni il timestamp della cache delle schede condivise (standardized format)
    getSharedRoutinesCacheTimestamp: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        const cacheEntry = this.safeGetItem(key);
        
        if (!cacheEntry || !this._validateCacheEntry(cacheEntry)) {
            return 0;
        }
        
        return cacheEntry.timestamp;
    },

    // Controlla se la cache delle schede condivise è scaduta (standardized duration)
    isSharedRoutinesCacheExpired: function(uid) {
        const timestamp = this.getSharedRoutinesCacheTimestamp(uid);
        const now = Date.now();
        return (now - timestamp) > this.CACHE_DURATION;
    },

    // Forza l'aggiornamento della cache delle schede condivise
    forceRefreshSharedRoutines: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        try {
            localStorage.removeItem(key);
            this._lruTracker.delete(key);
        } catch (error) {
            console.error('Failed to remove shared routines cache:', error);
        }
        console.log('Forced refresh of shared routines cache for user:', uid);
    },

    // Rimuovi una scheda condivisa dalla cache (with proper error handling)
    removeSharedRoutineFromCache: function(uid, routineId) {
        let sharedRoutines = this.getSharedRoutines(uid) || [];
        sharedRoutines = sharedRoutines.filter(r => r.id !== routineId);
        this.saveSharedRoutines(uid, sharedRoutines);
        console.log('Shared routine removed from cache:', routineId);
    },

    // Pulisci le vecchie schede condivise (mantieni solo le più recenti)
    clearOldSharedRoutines: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        try {
            const sharedRoutines = this.getSharedRoutines(uid) || [];
            if (sharedRoutines.length > this.MAX_CACHE_ITEMS) {
                // Mantieni solo le prime MAX_CACHE_ITEMS schede condivise
                const recentSharedRoutines = sharedRoutines.slice(0, this.MAX_CACHE_ITEMS);
                this.saveSharedRoutines(uid, recentSharedRoutines);
                console.log('Cleared old shared routines, kept:', recentSharedRoutines.length);
            }
        } catch (error) {
            console.warn('Failed to clear old shared routines:', error);
        }
    },
    
    // Cross-tab synchronization
    setupCrossTabSync: function() {
        window.addEventListener('storage', (e) => {
            if (e.key === null) {
                // Item was cleared
                console.log('Cache cleared in another tab');
                // Could trigger a full refresh if needed
                return;
            }
            
            const isRoutinesKey = e.key.startsWith(this.ROUTINES_KEY_PREFIX);
            const isSharedRoutinesKey = e.key.startsWith(this.SHARED_ROUTINES_KEY_PREFIX);
            const isPrefsKey = e.key.startsWith(this.PREFS_KEY_PREFIX);
            
            if (isRoutinesKey || isSharedRoutinesKey || isPrefsKey) {
                console.log('Cache updated in another tab:', e.key);
                
                // Invalidate in-memory cache if needed
                if (isRoutinesKey) {
                    window.dispatchEvent(new CustomEvent('routinesUpdatedFromOtherTab', { detail: { key: e.key } }));
                } else if (isSharedRoutinesKey) {
                    window.dispatchEvent(new CustomEvent('sharedRoutinesUpdatedFromOtherTab', { detail: { key: e.key } }));
                } else if (isPrefsKey) {
                    window.dispatchEvent(new CustomEvent('preferencesUpdatedFromOtherTab', { detail: { key: e.key } }));
                }
            }
        });
    },
    
    // Initialize cross-tab sync
    init: function() {
        this.setupCrossTabSync();
        console.log('CacheManager initialized with cross-tab sync');
    }
};

// Make it globally available
window.CacheManager = CacheManager;

// Apply theme immediately if available
CacheManager.applyGlobalTheme();

// Initialize cross-tab synchronization
CacheManager.init();
