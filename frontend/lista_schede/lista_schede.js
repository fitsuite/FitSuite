document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const routinesContainer = document.getElementById('routines-container');
    const searchInput = document.getElementById('search-bar');
    const refreshBtn = document.getElementById('refresh-btn');
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
        if (!window.CacheManager) return;
        
        // 1. Try Cache
        const prefs = window.CacheManager.getPreferences(uid);
        if (prefs && prefs.color) {
            setPrimaryColor(prefs.color);
            return;
        }

        // 2. Network Fallback (if CacheManager didn't have it)
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences) {
                    if (data.preferences.color) {
                        setPrimaryColor(data.preferences.color);
                    }
                    window.CacheManager.savePreferences(uid, data.preferences);
                }
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
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

    // Optimistic Load: Render immediately if we have a known user
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        console.log("Optimistic load for user:", lastUid);
        // Load preferences and routines immediately from cache
        loadUserPreferences(lastUid);
        fetchRoutines(lastUid);
        // We don't await sidebar here to unblock rendering
        waitForSidebar();
    }

    auth.onAuthStateChanged(async user => {
        if (user) {
            // Update lastUserId if different (should be rare)
            if (user.uid !== lastUid) {
                localStorage.setItem('lastUserId', user.uid);
            }
            
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

    // Refresh functionality
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('spinning');
            try {
                // Force cache refresh
                if (window.CacheManager) {
                    window.CacheManager.forceRefreshRoutines(auth.currentUser.uid);
                }
                // Fetch routines again with force refresh
                await fetchRoutines(auth.currentUser.uid, true);
            } catch (error) {
                console.error('Error refreshing routines:', error);
            } finally {
                refreshBtn.classList.remove('spinning');
            }
        });
    }

    async function fetchRoutines(uid, forceRefresh = false) {
        // 1. Check if we should force refresh
        const shouldRefresh = forceRefresh || !window.CacheManager || !window.CacheManager.getRoutines(uid);

        // 2. Load from Cache FIRST if valid and not forced refresh
        if (!shouldRefresh && window.CacheManager) {
            const cachedRoutines = window.CacheManager.getRoutines(uid);
            if (cachedRoutines !== null) {
                console.log("Routines loaded from cache, skipping DB");
                allRoutines = cachedRoutines;
                renderRoutines(allRoutines);
                return;
            }
        }

        try {
            console.log("Routines not in cache or forced refresh, fetching from DB");
            
            // 3. Fetch ONLY owned routines
            const ownedSnapshot = await db.collection('routines').where('userId', '==', uid).get();

            allRoutines = [];
            
            // Process owned routines only
            ownedSnapshot.forEach(doc => {
                allRoutines.push({ id: doc.id, ...doc.data(), isOwned: true });
            });

            if (allRoutines.length === 0) {
                renderRoutines([]);
                if (window.CacheManager) window.CacheManager.saveRoutines(uid, []);
                return;
            }

            // Sort by createdAt descending
            allRoutines.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            // 3. Update UI and Cache
            renderRoutines(allRoutines);
            if (window.CacheManager) {
                // Save top 20 to cache
                window.CacheManager.saveRoutines(uid, allRoutines.slice(0, 20));
            }

        } catch (error) {
            console.error("Errore nel recupero delle schede:", error);
            // If we have cache, we are fine (already rendered)
            // But if we failed and no cache, show error
            const cachedRoutines = window.CacheManager && window.CacheManager.getRoutines(uid);
            // If cache is null, it means we have no data at all (not even an empty list).
            // If cache is [], it means we successfully loaded 0 routines previously.
            if (cachedRoutines === null) {
                routinesContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Errore nel caricamento delle schede. Controlla la connessione.</div>';
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
                        <button class="menu-item share-btn">
                            <i class="fas fa-share-alt"></i> Condividi
                        </button>
                        <button class="menu-item rename-btn">
                            <i class="fas fa-edit"></i> Rinomina
                        </button>
                        <button class="menu-item delete-btn delete">
                            <i class="fas fa-trash-alt"></i> Elimina
                        </button>
                    </div>
                </div>
                <div class="col-name">
                    <span class="routine-name">${routine.name || 'Scheda senza nome'}</span>
                </div>
                <div class="col-sessions">
                    <span>${seduteText}</span>
                </div>
                <div class="col-date">
                    <span>${periodText}</span>
                </div>
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

            // Check if user is owner
            const isOwner = routine.isOwned !== false; // Default to true for backward compatibility
            
            // Show/hide actions based on ownership
            const shareMenuItem = routineItem.querySelector('.share-btn');
            const renameMenuItem = routineItem.querySelector('.rename-btn');
            const deleteMenuItem = routineItem.querySelector('.delete-btn');
            
            if (!isOwner) {
                if (shareMenuItem) shareMenuItem.style.display = 'none';
                if (renameMenuItem) renameMenuItem.style.display = 'none';
                if (deleteMenuItem) deleteMenuItem.style.display = 'none';
            }

            // Share Action
            if (shareMenuItem && isOwner) {
                shareMenuItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (window.showSharePopup) {
                        await window.showSharePopup(routine.id);
                    }
                });
            }

            // Rename Action
            if (renameMenuItem) {
                renameMenuItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    const newName = await window.showPrompt("Inserisci il nuovo nome della scheda:", routine.name, "Rinomina Scheda");
                    if (newName && newName.trim() !== "" && newName !== routine.name) {
                        // Optimistic update
                        const oldName = routine.name;
                        routine.name = newName;
                        renderRoutines(allRoutines);
                        if (window.CacheManager) {
                            window.CacheManager.updateSingleRoutineInCache(auth.currentUser.uid, routine);
                        }

                        try {
                            await db.collection('routines').doc(routine.id).update({ name: newName });
                        } catch (error) {
                            console.error("Error renaming routine:", error);
                            if (window.showErrorToast) {
                                window.showErrorToast("Errore durante la rinomina della scheda.");
                            }
                            // Revert
                            routine.name = oldName;
                            renderRoutines(allRoutines);
                            if (window.CacheManager) {
                                window.CacheManager.updateSingleRoutineInCache(auth.currentUser.uid, routine);
                            }
                        }
                    }
                });
            }

            // Delete Action
            if (deleteMenuItem) {
                deleteMenuItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (await window.showConfirm(`Sei sicuro di voler eliminare la scheda "${routine.name}"?`, "Elimina Scheda")) {
                        // Optimistic update
                        const originalRoutines = [...allRoutines];
                        allRoutines = allRoutines.filter(r => r.id !== routine.id);
                        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                        filterRoutines(searchTerm);
                        if (window.CacheManager) {
                            window.CacheManager.removeRoutineFromCache(auth.currentUser.uid, routine.id);
                        }

                        try {
                            await db.collection('routines').doc(routine.id).delete();
                        } catch (error) {
                            console.error("Error deleting routine:", error);
                            if (window.showErrorToast) {
                                window.showErrorToast("Errore durante l'eliminazione della scheda.");
                            }
                            // Revert
                            allRoutines = originalRoutines;
                            filterRoutines(searchTerm);
                            if (window.CacheManager) {
                                window.CacheManager.saveRoutines(auth.currentUser.uid, allRoutines.slice(0, 20));
                            }
                        }
                    }
                });
            }

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