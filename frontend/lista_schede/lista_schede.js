document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const routinesContainer = document.getElementById('routines-container');
    const searchInput = document.getElementById('search-bar');
    const loadingScreen = document.getElementById('loading-screen');

    let allRoutines = []; // Store routines for client-side filtering

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

    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

    async function loadUserPreferences(uid) {
        const cacheKey = `userPreferences_${uid}`;
        // 1. Try Cache
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const prefs = JSON.parse(cached);
                if (prefs.color) {
                    setPrimaryColor(prefs.color);
                    return; // Skip network if cached
                }
            }
        } catch (e) {
            console.error("Cache error:", e);
        }

        // 2. Network Fallback
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences) {
                    if (data.preferences.color) {
                        setPrimaryColor(data.preferences.color);
                    }
                    // Save to cache
                    localStorage.setItem(cacheKey, JSON.stringify(data.preferences));
                }
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
        }
    }

    // Helper to update local routines cache (Limit 20)
    function updateLocalRoutinesCache(uid, routines) {
        const cacheKey = `cachedRoutines_${uid}`;
        // Sort by createdAt descending
        const sorted = [...routines].sort((a, b) => {
            const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        // Take top 20
        const toCache = sorted.slice(0, 20).map(r => {
            return {
                ...r,
                // Serialize timestamps to ISO strings for storage
                createdAt: r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString() : r.createdAt,
                startDate: r.startDate && r.startDate.toDate ? r.startDate.toDate().toISOString() : r.startDate,
                endDate: r.endDate && r.endDate.toDate ? r.endDate.toDate().toISOString() : r.endDate
            };
        });
        
        localStorage.setItem(cacheKey, JSON.stringify(toCache));
    }

    // Helper to get routines from local cache
    function getLocalRoutinesCache(uid) {
        const cacheKey = `cachedRoutines_${uid}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        try {
            const routines = JSON.parse(cached);
            return routines.map(r => ({
                ...r,
                // Hydrate timestamps with a mock toDate() method
                createdAt: r.createdAt ? { toDate: () => new Date(r.createdAt) } : null,
                startDate: r.startDate ? { toDate: () => new Date(r.startDate) } : null,
                endDate: r.endDate ? { toDate: () => new Date(r.endDate) } : null
            }));
        } catch (e) {
            console.error("Error parsing routines cache", e);
            return null;
        }
    }

    function waitForSidebar() {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                if (document.querySelector('.sidebar')) {
                    resolve();
                } else if (Date.now() - start > 5000) {
                    console.warn("Sidebar load timeout");
                    resolve();
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    }

    auth.onAuthStateChanged(async user => {
        if (user) {
            try {
                await Promise.all([
                    loadUserPreferences(user.uid),
                    fetchRoutines(user.uid),
                    waitForSidebar()
                ]);
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                if (loadingScreen) loadingScreen.style.display = 'none';
            }
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterRoutines(searchTerm);
        });
    }

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.col-menu')) {
            document.querySelectorAll('.menu-dropdown').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });

    async function fetchRoutines(uid) {
        // 1. Load from Cache FIRST for speed
        const cachedRoutines = getLocalRoutinesCache(uid);
        if (cachedRoutines && cachedRoutines.length > 0) {
            allRoutines = cachedRoutines;
            renderRoutines(allRoutines);
        }

        try {
            // 2. Fetch from Network (Background Refresh)
            const snapshot = await db.collection('routines')
                .where('userId', '==', uid)
                .get();

            if (snapshot.empty) {
                allRoutines = [];
                renderRoutines([]);
                updateLocalRoutinesCache(uid, []);
                return;
            }

            allRoutines = [];
            snapshot.forEach(doc => {
                allRoutines.push({ id: doc.id, ...doc.data() });
            });

            // Sort by createdAt descending (same as sidebar.js)
            allRoutines.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            // 3. Update UI and Cache
            renderRoutines(allRoutines);
            updateLocalRoutinesCache(uid, allRoutines);

        } catch (error) {
            console.error("Errore nel recupero delle schede:", error);
            if (!cachedRoutines || cachedRoutines.length === 0) {
                routinesContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Errore nel caricamento delle schede. Riprova più tardi.</div>';
            }
        }
    }

    function renderRoutines(routines) {
        routinesContainer.innerHTML = '';

        if (routines.length === 0) {
            routinesContainer.innerHTML = '<div style="text-align: center; color: var(--text-gray); padding: 40px;">Nessuna scheda trovata.</div>';
            return;
        }

        routines.forEach(routine => {
            const routineItem = document.createElement('div');
            routineItem.className = 'routine-list-row';
            
            // Format Data
            const seduteText = `${routine.sedute || 0} sedute`;
            
            let periodText = '-';
            if (routine.startDate && routine.endDate) {
                try {
                    const start = routine.startDate.toDate();
                    const end = routine.endDate.toDate();
                    const options = { day: '2-digit', month: '2-digit', year: '2-digit' };
                    const startStr = start.toLocaleDateString('it-IT', options);
                    const endStr = end.toLocaleDateString('it-IT', options);
                    periodText = `${startStr} - ${endStr}`;
                } catch (e) {
                    console.error("Error formatting dates", e);
                }
            }

            routineItem.innerHTML = `
                <div class="col-menu">
                    <button class="menu-trigger">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="menu-dropdown">
                        <button class="menu-item rename-btn">
                            <i class="fas fa-edit"></i> Rinomina
                        </button>
                        <button class="menu-item delete-btn delete">
                            <i class="fas fa-trash-alt"></i> Elimina
                        </button>
                    </div>
                </div>
                <div class="col-name" title="${routine.name || 'Scheda senza nome'}">${routine.name || 'Scheda senza nome'}</div>
                <div class="col-sessions">${seduteText}</div>
                <div class="col-date">${periodText}</div>
                <div class="col-actions">
                    <a href="../visualizza_scheda/visualizza_scheda.html?id=${routine.id}" class="view-btn">Visualizza</a>
                </div>
            `;

            // Menu Event Listeners
            const menuTrigger = routineItem.querySelector('.menu-trigger');
            const menuDropdown = routineItem.querySelector('.menu-dropdown');
            
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other menus
                document.querySelectorAll('.menu-dropdown').forEach(m => {
                    if (m !== menuDropdown) m.classList.remove('active');
                });
                menuDropdown.classList.toggle('active');
            });

            // Rename Action
            const renameBtn = routineItem.querySelector('.rename-btn');
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                const newName = prompt("Inserisci il nuovo nome della scheda:", routine.name);
                if (newName && newName.trim() !== "" && newName !== routine.name) {
                    // Optimistic update
                    const oldName = routine.name;
                    routine.name = newName;
                    renderRoutines(allRoutines);
                    updateLocalRoutinesCache(auth.currentUser.uid, allRoutines);

                    try {
                        await db.collection('routines').doc(routine.id).update({ name: newName });
                    } catch (error) {
                        console.error("Error renaming routine:", error);
                        alert("Errore durante la rinomina della scheda.");
                        // Revert
                        routine.name = oldName;
                        renderRoutines(allRoutines);
                        updateLocalRoutinesCache(auth.currentUser.uid, allRoutines);
                    }
                }
            });

            // Delete Action
            const deleteBtn = routineItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (confirm(`Sei sicuro di voler eliminare la scheda "${routine.name}"?`)) {
                    // Optimistic update
                    const originalRoutines = [...allRoutines];
                    allRoutines = allRoutines.filter(r => r.id !== routine.id);
                    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                    filterRoutines(searchTerm);
                    updateLocalRoutinesCache(auth.currentUser.uid, allRoutines);

                    try {
                        await db.collection('routines').doc(routine.id).delete();
                    } catch (error) {
                        console.error("Error deleting routine:", error);
                        alert("Errore durante l'eliminazione della scheda.");
                        // Revert
                        allRoutines = originalRoutines;
                        filterRoutines(searchTerm);
                        updateLocalRoutinesCache(auth.currentUser.uid, allRoutines);
                    }
                }
            });

            routinesContainer.appendChild(routineItem);
        });
    }

    function filterRoutines(searchTerm) {
        if (!searchTerm) {
            renderRoutines(allRoutines);
            return;
        }
        
        const filtered = allRoutines.filter(routine => {
            const name = (routine.name || '').toLowerCase();
            return name.includes(searchTerm);
        });
        
        renderRoutines(filtered);
    }
});
