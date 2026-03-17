document.addEventListener('DOMContentLoaded', () => {
    // Funzione per verificare la connessione
    function checkConnection() {
        if (!navigator.onLine) {
            showErrorToast('Non sei collegato alla rete. Controlla la tua connessione internet.', 'Nessuna Connessione', 8000);
        }
    }
    
    // Controlla la connessione al caricamento della pagina
    checkConnection();
    
    // Ascolta i cambiamenti di stato della connessione
    window.addEventListener('online', () => {
        showSuccessToast('Connessione ripristinata', 'Online');
    });
    
    window.addEventListener('offline', () => {
        showErrorToast('Connessione persa. Non sei collegato alla rete.', 'Offline', 8000);
    });
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Inizializza la loading screen
    window.LoadingManager.show([
        'Inizializzazione pagina...',
        'Caricamento preferenze utente...',
        'Caricamento scheda...',
        'Preparazione interfaccia...'
    ]);

    const schedaNameElement = document.getElementById('scheda-name');
    const dateRangeDisplay = document.getElementById('date-range-display');
    const seduteContainer = document.getElementById('sedute-container');

    let currentUser = null;
    let allExercisesData = []; // Variabile per memorizzare tutti i dati degli esercizi
    let exercisesMap = new Map(); // Map per lookup veloci per nome

    // Store routine data globally for popup access
    let globalRoutineData = null;

    // Funzione per tradurre i nomi degli esercizi se il database è caricato
    function updateExerciseNames() {
        if (!allExercisesData || allExercisesData.length === 0) return;
        
        const exerciseElements = document.querySelectorAll('.col-name[data-original-name]');
        exerciseElements.forEach(el => {
            const originalName = el.dataset.originalName;
            const fullExerciseData = exercisesMap.get(originalName);
            if (fullExerciseData && fullExerciseData.name_it) {
                el.textContent = fullExerciseData.name_it;
                // Update also the img alt and dataset if they exist
                const row = el.closest('.exercise-row');
                if (row) {
                    const img = row.querySelector('.exercise-gif-thumbnail');
                    if (img) {
                        img.alt = fullExerciseData.name_it;
                        img.dataset.exerciseName = fullExerciseData.name_it;
                    }
                }
            }
        });
    }

    // Carica i dati degli esercizi all'avvio
    async function loadAllExercisesData() {
        try {
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            allExercisesData = await response.json();
            
            // Crea una Map per lookup veloci
            exercisesMap = new Map(allExercisesData.map(ex => [ex.name, ex]));
            
            console.log("Dati esercizi caricati e mappati");
            // Dopo il caricamento, aggiorna i nomi se la scheda è già renderizzata
            updateExerciseNames();
        } catch (error) {
            console.error("Errore nel caricamento dei dati degli esercizi:", error);
        }
    }

    // Chiama la funzione per caricare i dati all'avvio
    loadAllExercisesData();

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

    // Helper to wait for sidebar
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

    // Helper to get Routine ID from URL
    function getRoutineIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    // Optimistic Load: Render immediately if we have a known user
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        const routineId = getRoutineIdFromUrl();
        if (routineId) {
            console.log("Optimistic load for routine:", routineId);
            loadUserPreferences(lastUid);
            loadRoutineData(routineId, lastUid);
            // Don't wait for sidebar here
            waitForSidebar();
        }
    }

    // --- Popup Navigation Management ---
    function isAnyPopupOpen() {
        const editModal = document.getElementById('edit-confirm-modal');
        const sharePopup = document.getElementById('share-popup-overlay');
        const customPopup = document.getElementById('customPopup');

        return (editModal && editModal.classList.contains('active')) ||
               (sharePopup && sharePopup.classList.contains('show')) ||
               (customPopup && customPopup.classList.contains('show'));
    }

    function hideEditModal(fromBackAction = false) {
        const editModal = document.getElementById('edit-confirm-modal');
        if (editModal && editModal.classList.contains('active')) {
            editModal.classList.remove('active');
            // If we closed it manually (not from back action), pop the state
            if (!fromBackAction && history.state && history.state.popupOpen) {
                history.back();
            }
        }
    }

    function closeAllPopups(isBackAction = false) {
        let closedAny = false;

        // Edit Modal
        const editModal = document.getElementById('edit-confirm-modal');
        if (editModal && editModal.classList.contains('active')) {
            hideEditModal(isBackAction);
            closedAny = true;
        }

        // Share Popup
        const sharePopup = document.getElementById('share-popup-overlay');
        if (sharePopup && sharePopup.classList.contains('show')) {
            if (window.SharePopup && typeof window.SharePopup.hide === 'function') {
                window.SharePopup.hide();
            } else {
                sharePopup.classList.remove('show');
            }
            // Note: SharePopup.hide() might not support fromBackAction yet, 
            // but we'll handle it if needed. For now, manual back popping is in the hide method.
            closedAny = true;
        }

        // Custom Popup (Alert/Confirm)
        const customPopup = document.getElementById('customPopup');
        if (customPopup && customPopup.classList.contains('show')) {
            const cancelBtn = document.getElementById('customPopupCancel');
            if (cancelBtn && cancelBtn.style.display !== 'none') {
                cancelBtn.click();
            } else {
                const okBtn = document.getElementById('customPopupOk');
                if (okBtn) okBtn.click();
            }
            closedAny = true;
        }
    }

    function pushPopupState() {
        if (!history.state || !history.state.popupOpen) {
            history.pushState({ popupOpen: true }, '');
        }
    }

    if (!window._visualizzaSchedaPopstateAdded) {
        window.addEventListener('popstate', (event) => {
            // Handle visualizza_scheda specific popups
            hideEditModal(true);
            
            // Other components (SharePopup, customPopup) handle their own popstate
        });
        window._visualizzaSchedaPopstateAdded = true;
    }

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Check if user has username
            if (window.UsernameChecker) {
                const hasValidUsername = await window.UsernameChecker.enforceUsernameRequirement();
                if (!hasValidUsername) return;
            }

            try {
                currentUser = user;
                
                // Update lastUserId
                if (user.uid !== lastUid) {
                    localStorage.setItem('lastUserId', user.uid);
                }

                window.LoadingManager.nextStep('Caricamento preferenze utente...');
                const tasks = [
                    loadUserPreferences(user.uid),
                    waitForSidebar()
                ];
                const routineId = getRoutineIdFromUrl();
                if (routineId) {
                    window.LoadingManager.nextStep('Caricamento scheda...');
                    tasks.push(loadRoutineData(routineId, user.uid));
                } else {
                    console.error("No routine ID found in URL.");
                }
                await Promise.all(tasks);
                
                window.LoadingManager.nextStep('Preparazione interfaccia completata');
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                window.LoadingManager.hide();
            }
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    async function loadUserPreferences(uid) {
        let shouldFetchFromDB = true;
        
        // 1. Try Cache
        if (window.CacheManager) {
            const prefs = window.CacheManager.getPreferences(uid);
            if (prefs && prefs.color) {
                setPrimaryColor(prefs.color);
                
                // Check if we should perform an actual DB fetch based on throttle
                if (!window.CacheManager.shouldFetch('preferences', uid)) {
                    console.log("Preferences loaded from cache (throttled), skipping DB");
                    shouldFetchFromDB = false;
                }
            }
        }

        if (!shouldFetchFromDB) return;

        // 2. Network Fallback (if CacheManager didn't have it or it's time to refresh)
        try {
            console.log("Fetching preferences from DB...");
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences) {
                    if (data.preferences.color) {
                        setPrimaryColor(data.preferences.color);
                    }
                    if (window.CacheManager) {
                        window.CacheManager.savePreferences(uid, data.preferences);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
        }
    }

    async function loadRoutineData(routineId, uid) {
        let shouldFetchFromDB = true;

        // 1. Try Cache
        if (window.CacheManager) {
            const cachedRoutines = window.CacheManager.getRoutines(uid);
            if (cachedRoutines) {
                const cachedRoutine = cachedRoutines.find(r => r.id === routineId);
                if (cachedRoutine) {
                    console.log("Routine loaded from cache:", routineId);
                    renderRoutine(cachedRoutine);
                    
                    // Check if we should perform an actual DB fetch based on throttle
                    if (!window.CacheManager.shouldFetch('routine_detail', routineId)) {
                        console.log("Routine fetch throttled (30s), skipping DB");
                        shouldFetchFromDB = false;
                    }
                }
            }
        }

        if (!shouldFetchFromDB) return;

        try {
            console.log("Routine not in cache or expired, fetching from DB:", routineId);
            const routineDoc = await db.collection('routines').doc(routineId).get();
            if (routineDoc.exists) {
                const routine = { id: routineDoc.id, ...routineDoc.data() };
                renderRoutine(routine);
                if (window.CacheManager) {
                    window.CacheManager.updateSingleRoutineInCache(uid, routine);
                    window.CacheManager.markFetched('routine_detail', routineId);
                }
            } else {
                console.error("Routine not found.");
            }
        } catch (error) {
            console.error("Error loading routine data:", error);
        }
    }

    function handleEditButton(routine) {
        const editBtn = document.querySelector('.edit-btn');
        const shareBtn = document.querySelector('.share-btn');
        const removeSavedBtn = document.querySelector('.remove-saved-btn');
        
        if (!editBtn || !shareBtn || !removeSavedBtn) return;

        const modal = document.getElementById('edit-confirm-modal');
        const confirmBtn = document.getElementById('confirm-edit-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');

        function updateButtonVisibility() {
            const isOwner = currentUser && routine.userId === currentUser.uid;
            // Solo risoluzioni maggiori di mobile (es. > 768px)
            const isDesktop = window.innerWidth >= 768; 

            if (isOwner && isDesktop) {
                editBtn.style.display = 'flex';
                shareBtn.style.display = 'flex';
                removeSavedBtn.style.display = 'none';
            } else if (!isOwner && isDesktop) {
                editBtn.style.display = 'none';
                shareBtn.style.display = 'none';
                removeSavedBtn.style.display = 'flex';
            } else {
                // Mobile: hide all buttons
                editBtn.style.display = 'none';
                shareBtn.style.display = 'none';
                removeSavedBtn.style.display = 'none';
            }
        }

        updateButtonVisibility();

        // Aggiorna visibilità al resize (solo una volta)
        if (!window._visualizzaSchedaResizeAdded) {
            window.addEventListener('resize', updateButtonVisibility, { passive: true });
            window._visualizzaSchedaResizeAdded = true;
        }

        // Gestione click Edit
        editBtn.onclick = (e) => {
            e.preventDefault();
            if (modal) {
                modal.classList.add('active');
                pushPopupState();
            }
        };

        // Gestione click Share
        shareBtn.onclick = (e) => {
            e.preventDefault();
            if (window.showSharePopup) {
                window.showSharePopup(routine.id);
            }
        };

        // Gestione click Remove Saved
        removeSavedBtn.onclick = async (e) => {
            e.preventDefault();
            if (await window.showConfirm(`Sei sicuro di voler rimuovere la scheda "${routine.name || 'Scheda'}" dalle tue schede salvate?`, "Rimuovi Scheda Salvata")) {
                await removeSharedRoutine(routine.id);
            }
        };

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                window.location.href = `../crea_scheda/crea_scheda.html?id=${routine.id}`;
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                hideEditModal(false);
            };
        }
    }

    // Close on click outside
    const modal = document.getElementById('edit-confirm-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideEditModal(false);
            }
        });
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
                const updatedCondivisioni = condivisioni.filter(uid => uid !== currentUser.uid);
                const updatedAcceptedUsers = acceptedUsers.filter(uid => uid !== currentUser.uid);
                
                await routineRef.update({ 
                    condivisioni: updatedCondivisioni,
                    acceptedUsers: updatedAcceptedUsers
                });
                
                // Update cache if available
                if (window.CacheManager) {
                    window.CacheManager.forceRefreshSharedRoutines(currentUser.uid);
                }
                
                if (window.showSuccessToast) {
                    window.showSuccessToast('Scheda rimossa con successo!', 'Scheda rimossa');
                }
                
                // Redirect to shared routines page
                window.location.href = '../schede_condivise/schede_condivise.html';
            }
        } catch (error) {
            console.error('Error removing shared routine:', error);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante la rimozione della scheda.', 'Errore');
            }
        }
    }

    function renderRoutine(routine) {
        globalRoutineData = routine;
        schedaNameElement.textContent = routine.name;

        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        let dateRangeText = '';
        if (routine.startDate && routine.endDate) {
            const startDate = routine.startDate.toDate().toLocaleDateString('it-IT', options);
            const endDate = routine.endDate.toDate().toLocaleDateString('it-IT', options);
            dateRangeText = `${startDate} - ${endDate}`;
        } else if (routine.startDate) {
            dateRangeText = routine.startDate.toDate().toLocaleDateString('it-IT', options);
        }
        dateRangeDisplay.textContent = dateRangeText;

        seduteContainer.innerHTML = '';
        
        if (!routine.seduteData || routine.seduteData.length === 0) {
            seduteContainer.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 40px;">Nessuna seduta trovata per questa scheda.</p>';
            handleEditButton(routine);
            return;
        }

        // Chunked rendering: renderizza le sedute una alla volta per non bloccare il thread principale
        let sedutaIndex = 0;
        
        function renderNextSeduta() {
            if (sedutaIndex >= routine.seduteData.length) {
                handleEditButton(routine);
                return;
            }

            const seduta = routine.seduteData[sedutaIndex];
            const sedutaCard = createSedutaCard(seduta);
            seduteContainer.appendChild(sedutaCard);
            
            sedutaIndex++;
            // Renderizza la prossima seduta nel prossimo frame o dopo un piccolissimo delay
            if (sedutaIndex < 3) {
                // Le prime 2-3 sedute le renderizziamo subito o molto velocemente
                renderNextSeduta();
            } else {
                // Le altre le dilazioniamo leggermente per mantenere la fluidità
                requestAnimationFrame(renderNextSeduta);
            }
        }

        renderNextSeduta();
    }

    function createSedutaCard(seduta) {
        const sedutaCard = document.createElement('div');
        sedutaCard.className = 'card-section seduta-card';
        sedutaCard.dataset.sedutaId = seduta.id;
        
        sedutaCard.innerHTML = `
            <div class="seduta-header">
                <div class="seduta-title-container">
                    <button class="collapse-seduta-btn"><i class="fas fa-chevron-down"></i></button>
                    <h3 class="section-label">${seduta.name}</h3>
                </div>
                <div class="seduta-actions">
                    <button class="view-exercises-btn" data-seduta-id="${seduta.id}">
                        Visualizza Esercizi <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="seduta-body">
                <div class="seduta-exercises-header">
                    <span class="header-col col-name">Esercizio</span>
                    <span class="header-col col-rep">Rep</span>
                    <span class="header-col col-set">Serie</span>
                    <span class="header-col col-rest">Recupero</span>
                    <span class="header-col col-weight">Peso (kg)</span>
                    <span class="header-col col-note">Nota</span>
                    <span class="header-col col-photo">Foto</span>
                </div>
                <div class="seduta-content">
                    <div class="exercises-list"></div>
                </div>
            </div>
        `;

        const exercisesList = sedutaCard.querySelector('.exercises-list');
        const fragment = document.createDocumentFragment();

        if (seduta.exercises && seduta.exercises.length > 0) {
            seduta.exercises.forEach(exercise => {
                const fullExerciseData = exercisesMap.get(exercise.name);
                const displayExerciseName = fullExerciseData ? fullExerciseData.name_it : exercise.name;

                const exerciseRow = document.createElement('div');
                exerciseRow.className = 'exercise-row';
                
                const reps = exercise.reps || '-';
                const sets = exercise.sets || '-';
                const rest = exercise.rest ? `${exercise.rest} <span style="color: var(--text-gray)">sec</span>` : `- <span style="color: var(--text-gray)">sec</span>`;
                const weight = exercise.weight ? `${exercise.weight} <span style="color: var(--text-gray)">kg</span>` : `- <span style="color: var(--text-gray)">kg</span>`;
                const note = exercise.note || '-';

                exerciseRow.innerHTML = `
                    <span class="exercise-detail col-name" data-original-name="${exercise.name}">${displayExerciseName}</span>
                    <span class="exercise-detail col-rep">${reps}</span>
                    <span class="exercise-detail col-set">${sets}</span>
                    <span class="exercise-detail col-rest">${rest}</span>
                    <span class="exercise-detail col-weight">${weight}</span>
                    <span class="exercise-detail col-note">${note}</span>
                    <span class="exercise-detail col-photo">
                        <img src="${exercise.photo || 'https://via.placeholder.com/90'}" alt="${displayExerciseName}" data-exercise-name="${displayExerciseName}" class="exercise-gif-thumbnail" loading="lazy">
                    </span>
                `;
                
                const exerciseGifThumbnail = exerciseRow.querySelector('.exercise-gif-thumbnail');
                if (exerciseGifThumbnail) {
                    exerciseGifThumbnail.addEventListener('click', () => {
                        const routineId = globalRoutineData.id;
                        const sedutaId = seduta.id;
                        const exerciseIndex = seduta.exercises.indexOf(exercise);
                        
                        window.location.href = `../visualizza_esercizio/visualizza_esercizio.html?routineId=${routineId}&sedutaId=${sedutaId}&exerciseIndex=${exerciseIndex}`;
                    });
                }
                fragment.appendChild(exerciseRow);
            });
            exercisesList.appendChild(fragment);
        } else {
            exercisesList.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 20px;">Nessun esercizio in questa seduta.</p>';
        }

        const collapseBtn = sedutaCard.querySelector('.collapse-seduta-btn');
        const sedutaBody = sedutaCard.querySelector('.seduta-body');
        if (collapseBtn && sedutaBody) {
            collapseBtn.addEventListener('click', () => {
                sedutaBody.classList.toggle('collapsed');
                collapseBtn.classList.toggle('collapsed');
            });
        }

        // Aggiungi listener per il pulsante "Visualizza Esercizi"
        const viewExercisesBtn = sedutaCard.querySelector('.view-exercises-btn');
        if (viewExercisesBtn) {
            viewExercisesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const routineId = globalRoutineData.id;
                const sedutaId = seduta.id;
                // Reindirizza al primo esercizio della seduta (indice 0)
                window.location.href = `../visualizza_esercizio/visualizza_esercizio.html?routineId=${routineId}&sedutaId=${sedutaId}&exerciseIndex=0`;
            });
        }

        return sedutaCard;
    }

});
