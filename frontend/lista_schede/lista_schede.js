document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const routinesContainer = document.getElementById('routines-container');
    const searchInput = document.getElementById('search-bar');
    const loadingScreen = document.getElementById('loading-screen');

    let allRoutines = []; // Store routines for client-side filtering

    auth.onAuthStateChanged(user => {
        if (user) {
            fetchRoutines(user.uid);
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
        try {
            const snapshot = await db.collection('routines')
                .where('userId', '==', uid)
                .get();

            if (snapshot.empty) {
                renderRoutines([]);
                if (loadingScreen) loadingScreen.style.display = 'none';
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

            renderRoutines(allRoutines);
            
            if (loadingScreen) loadingScreen.style.display = 'none';

        } catch (error) {
            console.error("Errore nel recupero delle schede:", error);
            routinesContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Errore nel caricamento delle schede. Riprova più tardi.</div>';
            if (loadingScreen) loadingScreen.style.display = 'none';
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
                    try {
                        await db.collection('routines').doc(routine.id).update({ name: newName });
                        routine.name = newName; // Update local data
                        renderRoutines(allRoutines); // Re-render
                    } catch (error) {
                        console.error("Error renaming routine:", error);
                        alert("Errore durante la rinomina della scheda.");
                    }
                }
            });

            // Delete Action
            const deleteBtn = routineItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove('active');
                if (confirm(`Sei sicuro di voler eliminare la scheda "${routine.name}"?`)) {
                    try {
                        await db.collection('routines').doc(routine.id).delete();
                        // Remove from local list
                        allRoutines = allRoutines.filter(r => r.id !== routine.id);
                        // Re-filter/Re-render
                        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                        filterRoutines(searchTerm);
                    } catch (error) {
                        console.error("Error deleting routine:", error);
                        alert("Errore durante l'eliminazione della scheda.");
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
