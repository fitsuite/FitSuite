document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const routinesContainer = document.getElementById('routines-container');
    const searchInput = document.getElementById('search-bar');
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingScreen = document.getElementById('loading-screen');

    let allRoutines = []; // Store shared routines for client-side filtering

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
        fetchSharedRoutines(lastUid);
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
                    fetchSharedRoutines(user.uid),
                    waitForSidebar()
                ]);
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                if (loadingScreen) loadingScreen.style.display = 'none';
            }

            // Set up periodic refresh every 2 minutes
            setInterval(async () => {
                if (window.CacheManager && window.CacheManager.isSharedRoutinesCacheExpired(user.uid)) {
                    console.log("Periodic refresh: Cache expired, fetching new shared routines");
                    await fetchSharedRoutines(user.uid);
                }
            }, 2 * 60 * 1000); // 2 minutes
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

    // Refresh functionality
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('spinning');
            try {
                // Force cache refresh
                if (window.CacheManager) {
                    window.CacheManager.forceRefreshSharedRoutines(auth.currentUser.uid);
                }
                await fetchSharedRoutines(auth.currentUser.uid, true);
            } catch (error) {
                console.error('Error refreshing shared routines:', error);
            } finally {
                refreshBtn.classList.remove('spinning');
            }
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

    async function fetchSharedRoutines(uid, forceRefresh = false) {
        // 1. Check if we should force refresh or cache is expired
        const shouldRefresh = forceRefresh || !window.CacheManager || 
                             window.CacheManager.isSharedRoutinesCacheExpired(uid) ||
                             !window.CacheManager.getSharedRoutines(uid);

        // 2. Load from Cache FIRST if valid and not expired
        if (!shouldRefresh && window.CacheManager) {
            const cachedSharedRoutines = window.CacheManager.getSharedRoutines(uid);
            if (cachedSharedRoutines !== null) {
                console.log("Shared routines loaded from cache, skipping DB");
                allRoutines = cachedSharedRoutines;
                renderRoutines(allRoutines);
                return;
            }
        }

        try {
            console.log("Fetching shared routines from DB (forced refresh:", shouldRefresh, ")");
            
            // Fetch only shared routines (not owned)
            const sharedSnapshot = await db.collection('routines')
                .where('condivisioni', 'array-contains', uid)
                .get();

            console.log("Found shared routines count:", sharedSnapshot.docs.length);

            allRoutines = [];
            
            // Process shared routines
            const processedIds = new Set(); // Track processed routine IDs to prevent duplicates
            
            for (const doc of sharedSnapshot.docs) {
                const routineData = doc.data();
                console.log("Processing shared routine:", doc.id, "owner:", routineData.userId);
                
                // Skip if already processed (duplicate)
                if (processedIds.has(doc.id)) {
                    console.log("Skipping duplicate routine:", doc.id);
                    continue;
                }
                
                // Don't include if user is also the owner
                if (routineData.userId !== uid) {
                    processedIds.add(doc.id); // Mark as processed
                    
                    // Get owner info
                    const ownerDoc = await db.collection('users').doc(routineData.userId).get();
                    const ownerData = ownerDoc.exists ? ownerDoc.data() : { username: 'Utente', email: '' };
                    
                    allRoutines.push({ 
                        id: doc.id, 
                        ...routineData, 
                        isOwned: false,
                        ownerInfo: ownerData
                    });
                    console.log("Added shared routine:", routineData.name || 'Unnamed');
                }
            }

            console.log("Final shared routines count:", allRoutines.length);

            if (allRoutines.length === 0) {
                renderRoutines([]);
                if (window.CacheManager) window.CacheManager.saveSharedRoutines(uid, []);
                return;
            }

            // Sort by createdAt descending
            allRoutines.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            // Update UI and Cache
            renderRoutines(allRoutines);
            if (window.CacheManager) {
                // Save top 20 to cache (deduplicated)
                window.CacheManager.saveSharedRoutines(uid, allRoutines.slice(0, 20));
            }

        } catch (error) {
            console.error("Errore nel recupero delle schede condivise:", error);
            // If we have cache, we are fine (already rendered)
            // But if we failed and no cache, show error
            const cachedSharedRoutines = window.CacheManager && window.CacheManager.getSharedRoutines(uid);
            if (cachedSharedRoutines === null) {
                routinesContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Errore nel caricamento delle schede condivise. Controlla la connessione.</div>';
            }
        }
    }

    function renderRoutines(routines) {
        routinesContainer.innerHTML = '';

        if (routines.length === 0) {
            routinesContainer.innerHTML = '<div style="text-align: center; color: var(--text-gray); padding: 40px;">Nessuna scheda condivisa trovata.</div>';
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

            // Get owner initials and create badge
            const ownerInitials = getInitials(routine.ownerInfo?.username || 'Utente');
            const isAccepted = routine.acceptedUsers && routine.acceptedUsers.includes(auth.currentUser.uid);
            const statusBadge = isAccepted ? 
                '<span class="accepted-badge">Accettata</span>' : 
                '<span class="pending-badge">In attesa</span>';

            routineItem.innerHTML = `
                <div class="col-menu">
                    <button class="menu-trigger">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="menu-dropdown">
                        <button class="menu-item view-btn">
                            <i class="fas fa-eye"></i> Visualizza
                        </button>
                        <button class="menu-item delete-btn delete">
                            <i class="fas fa-trash-alt"></i> Elimina
                        </button>
                    </div>
                </div>
                <div class="col-name" title="${routine.name || 'Scheda senza nome'}">
                    ${routine.name || 'Scheda senza nome'}
                    <div class="shared-status">
                        ${statusBadge}
                    </div>
                </div>
                <div class="col-owner">
                    <div class="shared-by-badge">
                        <div class="shared-by-avatar">${ownerInitials}</div>
                        <span>${routine.ownerInfo?.username || 'Utente'}</span>
                    </div>
                </div>
                <div class="col-sessions">${seduteText}</div>
                <div class="col-actions">
                    ${!isAccepted ? `
                        <div class="accept-reject-buttons">
                            <button class="accept-btn" data-id="${routine.id}">Accetta</button>
                            <button class="reject-btn" data-id="${routine.id}">Rifiuta</button>
                        </div>
                    ` : `
                        <a href="../visualizza_scheda/visualizza_scheda.html?id=${routine.id}" class="view-btn">Visualizza</a>
                    `}
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

            // View Action from menu
            const viewBtn = routineItem.querySelector('.menu-item.view-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (isAccepted) {
                        window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${routine.id}`;
                    } else {
                        if (await window.showConfirm("Devi prima accettare questa scheda condivisa. Vuoi accettarla ora?", "Accetta Scheda")) {
                            await acceptSharedRoutine(routine.id);
                        }
                    }
                });
            }

            // Delete Action
            const deleteBtn = routineItem.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (await window.showConfirm(`Sei sicuro di voler rimuovere la scheda condivisa "${routine.name}"?`, "Rimuovi Scheda")) {
                        await removeSharedRoutine(routine.id);
                    }
                });
            }

            // Accept/Reject buttons
            const acceptBtn = routineItem.querySelector('.accept-btn');
            const rejectBtn = routineItem.querySelector('.reject-btn');
            
            if (acceptBtn) {
                acceptBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await acceptSharedRoutine(routine.id);
                });
            }
            
            if (rejectBtn) {
                rejectBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (await window.showConfirm(`Sei sicuro di voler rifiutare la scheda "${routine.name}"?`, "Rifiuta Scheda")) {
                        await removeSharedRoutine(routine.id);
                    }
                });
            }

            routinesContainer.appendChild(routineItem);
        });
    }

    async function acceptSharedRoutine(routineId) {
        try {
            const routineRef = db.collection('routines').doc(routineId);
            const doc = await routineRef.get();
            
            if (doc.exists) {
                const routineData = doc.data();
                const acceptedUsers = routineData.acceptedUsers || [];
                
                if (!acceptedUsers.includes(auth.currentUser.uid)) {
                    acceptedUsers.push(auth.currentUser.uid);
                    await routineRef.update({ acceptedUsers });
                    
                    // Update local data
                    const routine = allRoutines.find(r => r.id === routineId);
                    if (routine) {
                        routine.acceptedUsers = acceptedUsers;
                        renderRoutines(allRoutines);
                        // Update cache
                        if (window.CacheManager) {
                            window.CacheManager.saveSharedRoutines(auth.currentUser.uid, allRoutines.slice(0, 20));
                        }
                    }
                    
                    if (window.showSuccessToast) {
                        window.showSuccessToast('Scheda accettata con successo!', 'Condivisione accettata');
                    }
                }
            }
        } catch (error) {
            console.error('Error accepting shared routine:', error);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante l\'accettazione della scheda.', 'Errore');
            }
        }
    }

    async function removeSharedRoutine(routineId) {
        try {
            const routineRef = db.collection('routines').doc(routineId);
            const doc = await routineRef.get();
            
            if (doc.exists) {
                const routineData = doc.data();
                const condivisioni = routineData.condivisioni || [];
                const acceptedUsers = routineData.acceptedUsers || [];
                
                // Remove user from condivisioni and acceptedUsers
                const updatedCondivisioni = condivisioni.filter(uid => uid !== auth.currentUser.uid);
                const updatedAcceptedUsers = acceptedUsers.filter(uid => uid !== auth.currentUser.uid);
                
                await routineRef.update({ 
                    condivisioni: updatedCondivisioni,
                    acceptedUsers: updatedAcceptedUsers
                });
                
                // Remove from local data
                allRoutines = allRoutines.filter(r => r.id !== routineId);
                renderRoutines(allRoutines);
                
                // Update cache
                if (window.CacheManager) {
                    window.CacheManager.saveSharedRoutines(auth.currentUser.uid, allRoutines.slice(0, 20));
                }
                
                if (window.showSuccessToast) {
                    window.showSuccessToast('Scheda rimossa con successo!', 'Scheda rimossa');
                }
            }
        } catch (error) {
            console.error('Error removing shared routine:', error);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante la rimozione della scheda.', 'Errore');
            }
        }
    }

    function filterRoutines(searchTerm) {
        if (!searchTerm) {
            renderRoutines(allRoutines);
            return;
        }
        
        const filtered = allRoutines.filter(routine => {
            const name = (routine.name || '').toLowerCase();
            const ownerName = (routine.ownerInfo?.username || '').toLowerCase();
            return name.includes(searchTerm) || ownerName.includes(searchTerm);
        });
        
        renderRoutines(filtered);
    }

    function getInitials(name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
});
