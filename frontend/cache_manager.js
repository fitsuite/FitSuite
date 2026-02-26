const CacheManager = {
    PREFS_KEY_PREFIX: 'userPreferences_',
    ROUTINES_KEY_PREFIX: 'cachedRoutines_',
    SHARED_ROUTINES_KEY_PREFIX: 'cachedSharedRoutines_',

    GLOBAL_THEME_KEY: 'globalThemePrefs',

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
        localStorage.setItem(this.PREFS_KEY_PREFIX + uid, JSON.stringify(prefs));
        this.saveGlobalTheme(prefs); // Also save globally
        window.dispatchEvent(new CustomEvent('preferencesUpdated', { detail: prefs }));
    },

    getPreferences: function(uid) {
        const cached = localStorage.getItem(this.PREFS_KEY_PREFIX + uid);
        return cached ? JSON.parse(cached) : null;
    },

    saveRoutines: function(uid, routines) {
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

        localStorage.setItem(this.ROUTINES_KEY_PREFIX + uid, JSON.stringify(toSave));
        // Dispatch event if needed
        window.dispatchEvent(new CustomEvent('routinesUpdated', { detail: routines }));
    },

    getRoutines: function(uid) {
        const cached = localStorage.getItem(this.ROUTINES_KEY_PREFIX + uid);
        if (!cached) return null;
        try {
            const parsed = JSON.parse(cached);
            return this._reviveDates(parsed);
        } catch (e) {
            console.error("Error parsing cached routines:", e);
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

    // Rimuovi una routine dalla cache
    removeRoutineFromCache: function(uid, routineId) {
        let routines = this.getRoutines(uid) || [];
        routines = routines.filter(r => r.id !== routineId);
        this.saveRoutines(uid, routines);
        console.log('Routine removed from cache:', routineId);
    },

    // Forza l'aggiornamento della cache delle schede possedute
    forceRefreshRoutines: function(uid) {
        const key = this.ROUTINES_KEY_PREFIX + uid;
        localStorage.removeItem(key);
        console.log('Forced refresh of routines cache for user:', uid);
    },

    // SHARED ROUTINES CACHE METHODS

    // Salva le schede condivise nella cache
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
        
        const dataToCache = {
            timestamp: Date.now(),
            routines: uniqueRoutines
        };
        
        try {
            localStorage.setItem(key, JSON.stringify(dataToCache));
            console.log('Shared routines cached for user:', uid, 'Count:', uniqueRoutines.length);
        } catch (error) {
            console.warn('Failed to cache shared routines:', error);
            this.clearOldSharedRoutines(uid);
            try {
                localStorage.setItem(key, JSON.stringify(dataToCache));
            } catch (retryError) {
                console.warn('Retry failed for shared routines cache:', retryError);
            }
        }
    },

    // Ottieni le schede condivise dalla cache
    getSharedRoutines: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const data = JSON.parse(cached);
                if (data && data.routines) {
                    console.log('Shared routines loaded from cache for user:', uid, 'Count:', data.routines.length);
                    return this._reviveDates(data.routines);
                }
            }
        } catch (error) {
            console.warn('Failed to load shared routines from cache:', error);
            localStorage.removeItem(key);
        }
        return null;
    },

    // Ottieni il timestamp della cache delle schede condivise
    getSharedRoutinesCacheTimestamp: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const data = JSON.parse(cached);
                if (data && data.timestamp) {
                    return data.timestamp;
                }
            }
        } catch (error) {
            console.warn('Failed to get shared routines cache timestamp:', error);
        }
        return 0;
    },

    // Controlla se la cache delle schede condivise è scaduta (5 minuti)
    isSharedRoutinesCacheExpired: function(uid) {
        const timestamp = this.getSharedRoutinesCacheTimestamp(uid);
        const now = Date.now();
        const cacheDuration = 5 * 60 * 1000; // 5 minuti
        return (now - timestamp) > cacheDuration;
    },

    // Forza l'aggiornamento della cache delle schede condivise
    forceRefreshSharedRoutines: function(uid) {
        const key = this.SHARED_ROUTINES_KEY_PREFIX + uid;
        localStorage.removeItem(key);
        console.log('Forced refresh of shared routines cache for user:', uid);
    },

    // Rimuovi una scheda condivisa dalla cache
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
            if (sharedRoutines.length > 50) {
                // Mantieni solo le prime 50 schede condivise
                const recentSharedRoutines = sharedRoutines.slice(0, 50);
                localStorage.setItem(key, JSON.stringify(recentSharedRoutines));
                console.log('Cleared old shared routines, kept:', recentSharedRoutines.length);
            }
        } catch (error) {
            console.warn('Failed to clear old shared routines:', error);
        }
    }
};

// Make it globally available
window.CacheManager = CacheManager;

// Apply theme immediately if available
CacheManager.applyGlobalTheme();
