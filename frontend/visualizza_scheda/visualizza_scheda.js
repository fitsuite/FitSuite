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

    // Carica i dati degli esercizi all'avvio
    async function loadAllExercisesData() {
        try {
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            allExercisesData = await response.json();
            console.log("Dati esercizi caricati:", allExercisesData);
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

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
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
        if (!window.CacheManager) return;

        // 1. Try Cache
        const prefs = window.CacheManager.getPreferences(uid);
        if (prefs && prefs.color) {
            // Apply primary color if function exists
            if (typeof setPrimaryColor === 'function') {
                setPrimaryColor(prefs.color);
            }
            return;
        }

        // 2. Network Fallback
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences) {
                    if (data.preferences.color) {
                        // Apply primary color if function exists
                        if (typeof setPrimaryColor === 'function') {
                            setPrimaryColor(data.preferences.color);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }

    async function loadRoutineData(routineId, uid) {
        // 1. Try Cache
        if (window.CacheManager) {
            const cachedRoutines = window.CacheManager.getRoutines(uid);
            if (cachedRoutines) {
                const cachedRoutine = cachedRoutines.find(r => r.id === routineId);
                if (cachedRoutine) {
                    console.log("Routine loaded from cache:", routineId);
                    renderRoutine(cachedRoutine);
                    // Hide loading screen immediately if possible, or let Promise.all handle it
                    // But to be sure, we return early to skip DB
                    await waitForImages();
                    return;
                }
            }
        }

        try {
            console.log("Routine not in cache, fetching from DB:", routineId);
            const routineDoc = await db.collection('routines').doc(routineId).get();
            if (routineDoc.exists) {
                const routine = { id: routineDoc.id, ...routineDoc.data() };
                renderRoutine(routine);
                updateSingleRoutineInCache(uid, routine);
                await waitForImages();
            } else {
                console.error("Routine not found.");
                // Optionally redirect or show an error
            }
        } catch (error) {
            console.error("Error loading routine data:", error);
        }
    }

    function waitForImages() {
        const images = document.querySelectorAll('#sedute-container img');
        if (images.length === 0) return Promise.resolve();

        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve; // Resolve even on error to avoid hanging
            });
        });
        return Promise.all(promises);
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

        // Aggiorna visibilità al resize
        window.addEventListener('resize', updateButtonVisibility);

        // Gestione click Edit
        editBtn.onclick = (e) => {
            e.preventDefault();
            if (modal) modal.classList.add('active');
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
                if (modal) modal.classList.remove('active');
            };
        }
    }

    // Close on click outside
    const modal = document.getElementById('edit-confirm-modal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('active');
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

    // Store routine data globally for popup access
    let globalRoutineData = null;

    // Move this declaration before any usage
    function renderRoutine(routine) {
        globalRoutineData = routine; // Store routine data for popup access
        
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

        seduteContainer.innerHTML = ''; // Clear existing placeholder
        if (routine.seduteData && routine.seduteData.length > 0) {
            routine.seduteData.forEach(seduta => {
                const sedutaCard = document.createElement('div');
                sedutaCard.className = 'card-section seduta-card';
                sedutaCard.dataset.sedutaId = seduta.id;
                sedutaCard.innerHTML = `
                    <div class="seduta-header">
                        <div class="seduta-title-container">
                            <button class="collapse-seduta-btn"><i class="fas fa-chevron-down"></i></button>
                            <h3 class="section-label">${seduta.name}</h3>
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
                            <div class="exercises-list">
                                <!-- Exercise rows will be dynamically loaded here -->
                            </div>
                        </div>
                    </div>
                `;
                const exercisesList = sedutaCard.querySelector('.exercises-list');
                if (seduta.exercises && seduta.exercises.length > 0) {
                    seduta.exercises.forEach(exercise => {
                        // Find the corresponding exercise in allExercisesData to get the Italian name
                        const fullExerciseData = allExercisesData.find(ex => ex.name === exercise.name);
                        const displayExerciseName = fullExerciseData ? fullExerciseData.name_it : exercise.name; // Use Italian name if found, otherwise fallback to original

                        const exerciseRow = document.createElement('div');
                        exerciseRow.className = 'exercise-row';
                        
                        // Formatta i valori con '-' se mancanti e aggiunge unità di misura fisse
                        const reps = exercise.reps || '-';
                        const sets = exercise.sets || '-';
                        const rest = exercise.rest ? `${exercise.rest} sec` : '- sec';
                        const weight = exercise.weight ? `${exercise.weight} kg` : '- kg';
                        const note = exercise.note || '-';

                        exerciseRow.innerHTML = `
                            <span class="exercise-detail col-name">${displayExerciseName}</span>
                            <span class="exercise-detail col-rep">${reps}</span>
                            <span class="exercise-detail col-set">${sets}</span>
                            <span class="exercise-detail col-rest">${rest}</span>
                            <span class="exercise-detail col-weight">${weight}</span>
                            <span class="exercise-detail col-note">${note}</span>
                            <span class="exercise-detail col-photo">
                                <img src="${exercise.photo || 'https://via.placeholder.com/90'}" alt="Esercizio" data-exercise-name="${displayExerciseName}" class="exercise-gif-thumbnail">
                            </span>
                        `;
                        exercisesList.appendChild(exerciseRow);

                        const exerciseGifThumbnail = exerciseRow.querySelector('.exercise-gif-thumbnail');
                        if (exerciseGifThumbnail) {
                            exerciseGifThumbnail.addEventListener('click', () => {
                                // The data-exercise-name is already set to the Italian name
                                // Pass exercise data and routine data to popup
                                showExerciseDetailPopup(
                                    exerciseGifThumbnail.dataset.exerciseName, 
                                    exercise, 
                                    globalRoutineData
                                );
                            });
                        }
                    });
                } else {
                    exercisesList.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 20px;">Nessun esercizio in questa seduta.</p>';
                }
                seduteContainer.appendChild(sedutaCard);

                // Add collapse/expand functionality
                const collapseBtn = sedutaCard.querySelector('.collapse-seduta-btn');
                const sedutaBody = sedutaCard.querySelector('.seduta-body');

                if (collapseBtn && sedutaBody) {


                    collapseBtn.addEventListener('click', () => {
                        sedutaBody.classList.toggle('collapsed');
                        collapseBtn.classList.toggle('collapsed');
                    });
                }
            });
        } else {
            seduteContainer.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 40px;">Nessuna seduta trovata per questa scheda.</p>';
        }
        
        // Handle button visibility based on ownership
        handleEditButton(routine);
    }

    // Funzioni per la gestione del popup
    const exerciseDetailPopup = document.getElementById('exercise-detail-popup');
    const popupExerciseGif = document.getElementById('popup-exercise-gif');
    const popupExerciseName = document.getElementById('popup-exercise-name');
    const popupExerciseDescription = document.getElementById('popup-exercise-description');
    const closePopupBtn = document.querySelector('.close-popup-btn');
    
    // Notes functionality
    const exerciseNotesTextarea = document.getElementById('exercise-notes-textarea');
    const saveNotesBtn = document.getElementById('save-notes-btn');
    const notesCharCount = document.querySelector('.notes-char-count');
    
    let currentExerciseData = null;
    let currentRoutineData = null;
    let isSavingNotes = false;

    function hideExerciseDetailPopup() {
        exerciseDetailPopup.classList.remove('active');
        // Clear current exercise data
        currentExerciseData = null;
        currentRoutineData = null;
    }

    // Notes functionality
    function updateCharCount() {
        const currentLength = exerciseNotesTextarea.value.length;
        notesCharCount.textContent = `${currentLength}/500`;
        
        if (currentLength >= 450) {
            notesCharCount.style.color = '#ff6600';
        } else if (currentLength >= 400) {
            notesCharCount.style.color = '#ffaa00';
        } else {
            notesCharCount.style.color = 'var(--text-gray)';
        }
    }

    async function loadExerciseNotes(exerciseId, routineData) {
        if (!currentUser || !exerciseId) return;

        try {
            let notes = '';
            
            // Check if routine is owned by current user
            const isOwner = routineData.userId === currentUser.uid;
            
            console.log('🔥 Loading notes - Is owner:', isOwner);
            console.log('🔥 Loading notes - Exercise ID:', exerciseId);
            
            if (isOwner) {
                // For owned routines, get notes from exercise object
                console.log('🔥 Loading notes for owned routine');
                const routineRef = db.collection('routines').doc(routineData.id);
                const routineDoc = await routineRef.get();
                
                if (routineDoc.exists) {
                    const routine = routineDoc.data();
                    console.log('🔥 Loading notes - routine seduteData:', routine.seduteData);
                    
                    // Find exercise in all sedute
                    if (routine.seduteData) {
                        for (const seduta of routine.seduteData) {
                            if (seduta.exercises) {
                                const exercise = seduta.exercises.find(ex => {
                                    // Check both possible ID fields
                                    return (ex.exerciseId === exerciseId || ex.id === exerciseId);
                                });
                                if (exercise) {
                                    console.log('🔥 Found exercise:', exercise.name);
                                    console.log('🔥 Exercise notes field:', exercise.notes);
                                    notes = exercise.notes || ''; // Get notes field, default to empty string
                                    console.log('🔥 Loaded notes:', notes);
                                    break;
                                }
                            }
                        }
                    }
                }
            } else {
                // For shared routines, get notes from condivisioni
                console.log('🔥 Loading notes for shared routine');
                const routineRef = db.collection('routines').doc(routineData.id);
                const routineDoc = await routineRef.get();
                
                if (routineDoc.exists) {
                    const routine = routineDoc.data();
                    const condivisioni = routine.condivisioni || {};
                    
                    console.log('🔥 Loading notes - condivisioni type:', typeof condivisioni);
                    console.log('🔥 Loading notes - condivisioni:', condivisioni);
                    console.log('🔥 Loading notes - is array?', Array.isArray(condivisioni));
                    
                    if (Array.isArray(condivisioni)) {
                        // Old array structure - no notes supported
                        console.log('🔥 Condivisioni is array (old structure), no notes to load');
                        notes = '';
                    } else {
                        // New object structure
                        console.log('🔥 Condivisioni is object (new structure)');
                        
                        // Get user-specific notes from condivisioni
                        // Structure: condivisioni[userId][exerciseId] = { id: exerciseId, notes: notes }
                        if (condivisioni[currentUser.uid] && condivisioni[currentUser.uid][exerciseId]) {
                            const exerciseData = condivisioni[currentUser.uid][exerciseId];
                            console.log('🔥 Found exercise data:', exerciseData);
                            notes = exerciseData.notes || ''; // Get notes from the exercise object
                            console.log('🔥 Found notes for user:', notes);
                        } else {
                            console.log('🔥 No notes found for user and exercise');
                        }
                    }
                }
            }
            
            exerciseNotesTextarea.value = notes;
            updateCharCount();
            
        } catch (error) {
            console.error('🔥❌ Error loading exercise notes:', error);
            exerciseNotesTextarea.value = '';
            updateCharCount();
        }
    }

    async function saveExerciseNotes() {
        if (!currentUser || !currentExerciseData || !currentRoutineData || isSavingNotes) return;
        
        console.log('🔥 Starting saveExerciseNotes');
        console.log('🔥 Current user:', currentUser.uid);
        console.log('🔥 Exercise ID:', currentExerciseData.id);
        console.log('🔥 Exercise name:', currentExerciseData.name);
        console.log('🔥 Routine ID:', currentRoutineData.id);
        console.log('🔥 Notes to save:', exerciseNotesTextarea.value.trim());
        
        isSavingNotes = true;
        saveNotesBtn.disabled = true;
        saveNotesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';
        
        try {
            const notes = exerciseNotesTextarea.value.trim();
            // Use exerciseId instead of id - this is the correct field name
            const exerciseId = currentExerciseData.exerciseId || currentExerciseData.id;
            const isOwner = currentRoutineData.userId === currentUser.uid;
            
            console.log('🔥 Exercise ID (corrected):', exerciseId);
            console.log('🔥 Exercise data fields:', Object.keys(currentExerciseData));
            console.log('🔥 Full exercise data:', currentExerciseData);
            
            console.log('🔥 Is owner:', isOwner);
            
            if (isOwner) {
                // For owned routines, save notes directly in the specific exercise object
                console.log('🔥 Saving notes for owned routine - SPECIFIC EXERCISE');
                const routineRef = db.collection('routines').doc(currentRoutineData.id);
                const routineDoc = await routineRef.get();
                
                console.log('🔥 Routine doc exists:', routineDoc.exists);
                
                if (routineDoc.exists) {
                    const routine = routineDoc.data();
                    console.log('🔥 Current routine seduteData:', routine.seduteData);
                    
                    // Find and update ONLY the specific exercise in all sedute
                    if (routine.seduteData) {
                        let exerciseFound = false;
                        let exerciseUpdated = false;
                        
                        // Create deep copy of seduteData to avoid mutation issues
                        const updatedSeduteData = JSON.parse(JSON.stringify(routine.seduteData));
                        
                        for (let sedutaIndex = 0; sedutaIndex < updatedSeduteData.length; sedutaIndex++) {
                            const seduta = updatedSeduteData[sedutaIndex];
                            
                            if (seduta.exercises) {
                                for (let exerciseIndex = 0; exerciseIndex < seduta.exercises.length; exerciseIndex++) {
                                    const exercise = seduta.exercises[exerciseIndex];
                                    
                                    // Check both possible ID fields (exerciseId or id)
                                    const currentExerciseId = exercise.exerciseId || exercise.id;
                                    console.log(`🔥 Checking exercise ${exerciseIndex}: ${exercise.name} (ID: ${currentExerciseId})`);
                                    
                                    if (currentExerciseId === exerciseId) {
                                        console.log('🔥 ✅ FOUND TARGET EXERCISE:', exercise.name);
                                        console.log('🔥 Current notes:', exercise.notes);
                                        console.log('🔥 New notes:', notes);
                                        
                                        // Update ONLY this specific exercise
                                        seduta.exercises[exerciseIndex].notes = notes;
                                        exerciseFound = true;
                                        exerciseUpdated = true;
                                        
                                        console.log('🔥 ✅ UPDATED EXERCISE NOTES');
                                        break; // Exit exercise loop
                                    }
                                }
                                
                                if (exerciseUpdated) {
                                    break; // Exit seduta loop
                                }
                            }
                        }
                        
                        console.log('🔥 Exercise found:', exerciseFound);
                        console.log('🔥 Exercise updated:', exerciseUpdated);
                        
                        if (exerciseFound && exerciseUpdated) {
                            console.log('🔥 Writing SPECIFIC exercise to database...');
                            await routineRef.update({
                                seduteData: updatedSeduteData
                            });
                            console.log('🔥 ✅ Database write completed successfully!');
                            
                            // Update cache
                            if (window.CacheManager) {
                                const updatedRoutine = { ...currentRoutineData, seduteData: updatedSeduteData };
                                updateSingleRoutineInCache(currentUser.uid, updatedRoutine);
                            }
                        } else {
                            console.error('🔥❌ Exercise not found in routine!');
                            console.error('🔥❌ Looking for exercise ID:', exerciseId);
                        }
                    } else {
                        console.error('🔥❌ No seduteData found in routine!');
                    }
                } else {
                    console.error('🔥❌ Routine document does not exist!');
                }
            } else {
                // For shared routines, save notes in condivisioni with exerciseId as key
                console.log('🔥 Saving notes for shared routine - SPECIFIC EXERCISE');
                const routineRef = db.collection('routines').doc(currentRoutineData.id);
                const routineDoc = await routineRef.get();
                
                console.log('🔥 Routine doc exists:', routineDoc.exists);
                
                if (routineDoc.exists) {
                    const routine = routineDoc.data();
                    console.log('🔥 Current condivisioni type:', typeof routine.condivisioni);
                    console.log('🔥 Current condivisioni:', routine.condivisioni);
                    console.log('🔥 Is condivisioni array?', Array.isArray(routine.condivisioni));
                    
                    let condivisioni = routine.condivisioni || {};
                    
                    // If condivisioni is an array, convert to object structure
                    if (Array.isArray(condivisioni)) {
                        console.log('🔥 Condivisioni is array, converting to object structure');
                        const newCondivisioni = {};
                        
                        // Convert array to object with exercise notes structure
                        condivisioni.forEach(userId => {
                            newCondivisioni[userId] = {}; // Each user gets their own notes object
                        });
                        
                        // Add current user if not exists
                        if (!newCondivisioni[currentUser.uid]) {
                            newCondivisioni[currentUser.uid] = {};
                        }
                        
                        // Add the note for SPECIFIC exerciseId with proper structure
                        newCondivisioni[currentUser.uid][exerciseId] = {
                            id: exerciseId,
                            notes: notes
                        };
                        
                        console.log('🔥 New condivisioni structure:', newCondivisioni);
                        console.log('🔥 Added note for exercise:', exerciseId);
                        
                        console.log('🔥 Writing to database...');
                        await routineRef.update({
                            condivisioni: newCondivisioni
                        });
                        console.log('🔥 ✅ Database write completed successfully!');
                        
                    } else {
                        // Condivisioni is already an object
                        console.log('🔥 Condivisioni is object, using existing structure');
                        
                        // Initialize user's condivisioni data if not exists
                        if (!condivisioni[currentUser.uid]) {
                            condivisioni[currentUser.uid] = {};
                            console.log('🔥 Created user section in condivisioni');
                        }
                        
                        // Save note for SPECIFIC exerciseId with proper structure
                        // Structure: condivisioni[userId][exerciseId] = { id: exerciseId, notes: notes }
                        console.log('🔥 Adding note for exercise:', exerciseId);
                        condivisioni[currentUser.uid][exerciseId] = {
                            id: exerciseId,
                            notes: notes
                        };
                        console.log('🔥 Updated condivisioni structure:', condivisioni);
                        
                        console.log('🔥 Writing to database...');
                        await routineRef.update({
                            condivisioni: condivisioni
                        });
                        console.log('🔥 ✅ Database write completed successfully!');
                    }
                    
                    // Update cache
                    if (window.CacheManager) {
                        const updatedRoutine = { ...currentRoutineData, condivisioni };
                        updateSingleRoutineInCache(currentUser.uid, updatedRoutine);
                    }
                } else {
                    console.error('🔥❌ Routine document does not exist!');
                }
            }
            
            // Show success message
            if (window.showSuccessToast) {
                window.showSuccessToast('Appunti salvati con successo!', 'Salvataggio completato');
            }
            
        } catch (error) {
            console.error('🔥❌ Error saving exercise notes:', error);
            console.error('🔥❌ Full error details:', error.code, error.message);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante il salvataggio degli appunti: ' + error.message, 'Errore');
            }
        } finally {
            isSavingNotes = false;
            saveNotesBtn.disabled = false;
            saveNotesBtn.innerHTML = '<i class="fas fa-save"></i> Salva';
        }
    }

    function updateSingleRoutineInCache(uid, routine) {
        if (!window.CacheManager) return;
        
        try {
            const cachedRoutines = window.CacheManager.getRoutines(uid);
            if (cachedRoutines) {
                const updatedRoutines = cachedRoutines.map(r => 
                    r.id === routine.id ? routine : r
                );
                window.CacheManager.saveRoutines(uid, updatedRoutines);
            }
        } catch (error) {
            console.error('Error updating routine in cache:', error);
        }
    }

    // Test function to verify database connection and permissions
    window.testDatabaseWrite = async function() {
        if (!currentUser) {
            console.error('🔥❌ No user logged in!');
            return;
        }
        
        console.log('🔥 Testing database write permissions...');
        
        try {
            const routineRef = db.collection('routines').doc(currentRoutineData.id);
            const routineDoc = await routineRef.get();
            
            if (routineDoc.exists) {
                const routine = routineDoc.data();
                console.log('🔥 Current routine data:', routine);
                
                // Test write with a simple field
                await routineRef.update({
                    'testField': 'test_' + Date.now()
                });
                
                console.log('🔥 ✅ Database write test successful!');
                
                // Clean up test field
                const updatedData = { ...routine };
                delete updatedData.testField;
                await routineRef.set(updatedData);
                
                console.log('🔥 ✅ Database cleanup successful!');
            } else {
                console.error('🔥❌ Routine document not found!');
            }
        } catch (error) {
            console.error('🔥❌ Database write test failed:', error);
        }
    };

    // Test function to verify notes loading
    window.testNotesLoading = async function() {
        if (!currentUser || !currentExerciseData || !currentRoutineData) {
            console.error('🔥❌ Missing data for test!');
            return;
        }
        
        console.log('🔥 Testing notes loading...');
        await loadExerciseNotes(currentExerciseData.id, currentRoutineData);
    };

    // Listener per chiudere il popup
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', hideExerciseDetailPopup);
    }

    if (exerciseDetailPopup) {
        exerciseDetailPopup.addEventListener('click', (event) => {
            if (event.target === exerciseDetailPopup) {
                hideExerciseDetailPopup();
            }
        });
    }

    // Notes event listeners
    if (exerciseNotesTextarea) {
        exerciseNotesTextarea.addEventListener('input', updateCharCount);
    }

    if (saveNotesBtn) {
        saveNotesBtn.addEventListener('click', saveExerciseNotes);
    }

    // Stepper Logic
    const prevBtn = document.querySelector('.popup-nav-btn.prev');
    const nextBtn = document.querySelector('.popup-nav-btn.next');
    const dotsContainer = document.querySelector('.popup-dots');
    let currentStep = 0;
    let totalSteps = 0;

    function updateStepper() {
        const steps = document.querySelectorAll('.popup-step');
        const dots = document.querySelectorAll('.dot');
        
        console.log(`Updating stepper: currentStep=${currentStep}, totalSteps=${totalSteps}`);
        
        // Hide all steps and show only the current step
        steps.forEach((step, index) => {
            step.style.display = index === currentStep ? 'block' : 'none';
        });

        // Update dots active state
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentStep);
        });

        // Update button states
        prevBtn.disabled = currentStep === 0;
        nextBtn.disabled = currentStep === totalSteps - 1;
        
        console.log(`Step ${currentStep} displayed, Prev disabled: ${prevBtn.disabled}, Next disabled: ${nextBtn.disabled}`);
    }

    prevBtn.addEventListener('click', () => {
        console.log(`Prev button clicked. Current step: ${currentStep}`);
        if (currentStep > 0) {
            currentStep--;
            console.log(`Moving to step: ${currentStep}`);
            updateStepper();
        } else {
            console.log('Already at first step, cannot go back');
        }
    });

    nextBtn.addEventListener('click', () => {
        console.log(`Next button clicked. Current step: ${currentStep}, Total steps: ${totalSteps - 1}`);
        if (currentStep < totalSteps - 1) {
            currentStep++;
            console.log(`Moving to step: ${currentStep}`);
            updateStepper();
        } else {
            console.log('Already at last step, cannot go forward');
        }
    });

    function showExerciseDetailPopup(exerciseName, exerciseData = null, routineData = null) {
        console.log("Tentativo di mostrare popup per esercizio:", exerciseName);

        const languagePreference = localStorage.getItem('languagePreference') || 'it';
        const exerciseDataFromList = allExercisesData.find(ex => (languagePreference === 'it' ? ex.name_it : ex.name) === exerciseName);

        if (exerciseDataFromList) {
            console.log("Dati esercizio trovati:", exerciseDataFromList);
            popupExerciseGif.src = exerciseDataFromList.gifUrl;
            popupExerciseName.textContent = languagePreference === 'it' ? exerciseDataFromList.name_it : exerciseDataFromList.name;

            // Set current data for notes functionality
            currentExerciseData = exerciseData || exerciseDataFromList;
            currentRoutineData = routineData;

            // Usa sempre instructions_it per avere le istruzioni in italiano
            const instructions = exerciseDataFromList.instructions_it || exerciseDataFromList.instructions;
            totalSteps = instructions.length;
            currentStep = 0;
            
            console.log(`Caricate ${totalSteps} istruzioni:`, instructions);

            popupExerciseDescription.innerHTML = instructions.map((instruction, index) => {
                // Rimuovi i primi 6 caratteri ('Step:X:')
                let cleanedInstruction = instruction.substring(6).trim();
                console.log(`Istruzione originale ${index}:`, instruction);
                console.log(`Istruzione pulita ${index}:`, cleanedInstruction);
                
                return `<div class="popup-step" data-step="${index}">
                            <div class="step-card">
                                <span class="step-number">${index + 1}</span>
                                <p class="step-text">${cleanedInstruction}</p>
                            </div>
                        </div>`;
            }).join('');

            dotsContainer.innerHTML = instructions.map((_, index) => 
                `<span class="dot ${index === 0 ? 'active' : ''}" data-step="${index}"></span>`
            ).join('');

            // Aggiungi event listeners ai pallini
            const dots = dotsContainer.querySelectorAll('.dot');
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => {
                    currentStep = index;
                    updateStepper();
                });
            });

            // Load exercise notes if we have routine data
            if (routineData && currentExerciseData) {
                // Use exerciseId from the exercise data
                const exerciseId = currentExerciseData.exerciseId || currentExerciseData.id;
                console.log('🔥 Loading notes for exercise ID:', exerciseId);
                loadExerciseNotes(exerciseId, routineData);
            } else {
                // Reset notes section if no routine data
                exerciseNotesTextarea.value = '';
                updateCharCount();
            }

            updateStepper();
            exerciseDetailPopup.classList.add('active');
        } else {
            console.warn(`Dati per l'esercizio "${exerciseName}" non trovati.`);
        }
    }
});
