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
    
    const form = document.getElementById('ai-workout-form');
    const resetBtn = document.getElementById('reset-button');
    const resetConfirmModal = document.getElementById('reset-confirm-modal');
    const confirmResetBtn = document.getElementById('confirm-reset');
    const cancelResetBtn = document.getElementById('cancel-reset');
    
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Inizializza la loading screen
    window.LoadingManager.show([
        'Inizializzazione pagina...',
        'Caricamento preferenze utente...',
        'Preparazione interfaccia...'
    ]);

    // Utility per debouncing (per migliorare performance su mobile/iPad)
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    const colorMap = {
        'Arancione': '#ff6600',
        'Verde': '#4ade80',
        'Blu': '#3b82f6',
        'Rosa': '#f472b6'
    };

    const colorRGBMap = {
        'Arancione': '255, 102, 0',
        'Verde': '74, 222, 128',
        'Blu': '59, 130, 246',
        'Rosa': '244, 114, 182'
    };

    const gradientMap = {
        'Arancione': 'linear-gradient(135deg, #2b1d16 0%, #1a1a1a 100%)',
        'Verde': 'linear-gradient(135deg, #1a2b16 0%, #1a1a1a 100%)',
        'Blu': 'linear-gradient(135deg, #161d2b 0%, #1a1a1a 100%)',
        'Rosa': 'linear-gradient(135deg, #2b1625 0%, #1a1a1a 100%)'
    };

    let currentUser = null;

    // --- Popup Navigation Management ---
    function pushPopupState() {
        if (!history.state || !history.state.popupOpen) {
            history.pushState({ popupOpen: true }, '');
        }
    }

    function isAnyPopupOpen() {
        return resetConfirmModal && resetConfirmModal.classList.contains('show');
    }

    if (!window._creaSchedaAIPopstateAdded) {
        window.addEventListener('popstate', (event) => {
            if (resetConfirmModal && resetConfirmModal.classList.contains('show')) {
                hideResetModal(true);
            }
        });
        window._creaSchedaAIPopstateAdded = true;
    }

    function hideResetModal(fromBackAction = false) {
        if (resetConfirmModal && resetConfirmModal.classList.contains('show')) {
            resetConfirmModal.classList.remove('show');
            if (!fromBackAction && history.state && history.state.popupOpen) {
                history.back();
            }
        }
    }

    // --- Persistence Logic ---
    function saveDraft() {
        if (!currentUser) return;
        
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        
        localStorage.setItem(`crea_scheda_ai_draft_${currentUser.uid}`, JSON.stringify(data));
    }

    // Versione debounced di saveDraft per evitare sovraccarichi durante la digitazione
    const debouncedSaveDraft = debounce(saveDraft, 800);

    function loadDraft() {
        if (!currentUser) return;
        
        const draftJSON = localStorage.getItem(`crea_scheda_ai_draft_${currentUser.uid}`);
        if (!draftJSON) return;

        const draft = JSON.parse(draftJSON);
        
        for (let key in draft) {
            const val = draft[key];
            const inputs = form.querySelectorAll(`[name="${key}"]`);
            
            if (inputs.length === 0) continue;
            
            if (inputs[0].type === 'radio') {
                inputs.forEach(input => {
                    if (input.value === val) input.checked = true;
                });
                inputs[0].dispatchEvent(new Event('change'));
            } else if (inputs[0].type === 'checkbox') {
                const values = Array.isArray(val) ? val : [val];
                inputs.forEach(input => {
                    if (values.includes(input.value)) input.checked = true;
                });
            } else if (inputs[0].type === 'hidden') {
                inputs[0].value = val;
                const container = inputs[0].closest('.custom-select-container');
                if (container) {
                    const trigger = container.querySelector('.custom-select-trigger');
                    const option = container.querySelector(`.custom-option[data-value="${val}"]`);
                    if (trigger && option) {
                        trigger.querySelector('span').textContent = option.textContent;
                        trigger.classList.remove('placeholder');
                        container.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                    }
                }
            } else {
                inputs[0].value = val;
                inputs[0].dispatchEvent(new Event('input'));
            }
        }
    }

    function clearDraft() {
        if (currentUser) {
            localStorage.removeItem(`crea_scheda_ai_draft_${currentUser.uid}`);
        }
    }

    form.addEventListener('input', () => {
        debouncedSaveDraft();
    });
    
    form.addEventListener('change', () => {
        debouncedSaveDraft();
    });

    resetBtn.addEventListener('click', () => {
        pushPopupState();
        resetConfirmModal.classList.add('show');
    });

    confirmResetBtn.addEventListener('click', () => {
        clearDraft();
        location.reload();
    });

    cancelResetBtn.addEventListener('click', () => {
        hideResetModal(false);
    });

    function updateSliderBackground(slider) {
        if (!slider) return;
        const val = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        const primaryRGB = document.documentElement.style.getPropertyValue('--primary-color-rgb') || '255, 102, 0';
        slider.style.background = `linear-gradient(to right, rgba(${primaryRGB}, 0.5) ${val}%, #333 ${val}%)`;
    }

    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const rgb = colorRGBMap[colorName] || colorRGBMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--primary-color-rgb', rgb);
        document.documentElement.style.setProperty('--background-gradient', gradient);

        // Update slider backgrounds if they exist
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            if (typeof updateSliderBackground === 'function') {
                updateSliderBackground(slider);
            }
        });
    }

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

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Verifica email
            if (!user.emailVerified) {
                console.log('User not verified, redirecting to auth.html');
                window.location.href = '../auth/auth.html';
                return;
            }

            // Check if user has username
            if (window.UsernameChecker) {
                const hasValidUsername = await window.UsernameChecker.enforceUsernameRequirement();
                if (!hasValidUsername) return;
            }

            try {
                currentUser = user;
                window.LoadingManager.nextStep('Caricamento preferenze utente...');
                await Promise.all([
                    loadUserPreferences(user.uid),
                    waitForSidebar()
                ]);
                
                // Apply plan visibility
                if (window.PlanManager) {
                    window.PlanManager.applyAdsVisibility();
                }
                
                loadDraft();
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
                    console.log("CreaSchedaAI: Preferences loaded from cache (throttled), skipping DB");
                    shouldFetchFromDB = false;
                }
            }
        }

        if (!shouldFetchFromDB) return;
        
        // 2. Network Fallback
        try {
            console.log("CreaSchedaAI: Fetching preferences from DB...");
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

// Prevenire 'e' ed 'E' nei campi numerici, disabilitare scroll e limitare valori massimi
const numericInputs = document.querySelectorAll('input[type="number"]');
const limits = {
    'eta': 100,
    'altezza': 300,
    'peso': 500
};

numericInputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
        }
    });
    
    // Disabilita la modifica del valore tramite scroll/trackpad
    input.addEventListener('wheel', (e) => {
        e.preventDefault();
    }, { passive: false }); // Wheel e scroll di sistema possono richiedere passive: false per preventDefault

    // Rafforzamento dei limiti massimi via JS
     input.addEventListener('input', (e) => {
         const id = e.target.id;
         if (limits[id] && e.target.value > limits[id]) {
             e.target.value = limits[id];
         }
     });
 });

 // Gestione contatore caratteri per limitazioni
  const limitazioniInput = document.getElementById('limitazioni');
  const charCounter = document.getElementById('char-counter');
  if (limitazioniInput && charCounter) {
      limitazioniInput.addEventListener('input', () => {
          const remaining = 50 - limitazioniInput.value.length;
          charCounter.textContent = remaining;
          if (remaining <= 5) {
              charCounter.style.color = '#ff4444';
          } else {
              charCounter.style.color = 'var(--text-white)';
          }
      });
  }

// Gestione Select Personalizzate
function initCustomSelects() {
    const selects = document.querySelectorAll('.custom-select-container');
    
    selects.forEach(container => {
        const trigger = container.querySelector('.custom-select-trigger');
        const optionsList = container.querySelector('.custom-options');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const options = container.querySelectorAll('.custom-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Chiudi altre select aperte
            document.querySelectorAll('.custom-options.active').forEach(opt => {
                if (opt !== optionsList) opt.classList.remove('active');
            });
            optionsList.classList.toggle('active');
            trigger.classList.toggle('active');
        });

        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                const text = option.textContent;
                
                hiddenInput.value = value;
                trigger.querySelector('span').textContent = text;
                trigger.classList.remove('placeholder');
                
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                optionsList.classList.remove('active');
                trigger.classList.remove('active');
                debouncedSaveDraft();
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-options.active').forEach(opt => opt.classList.remove('active'));
        document.querySelectorAll('.custom-select-trigger.active').forEach(trig => trig.classList.remove('active'));
    });
}

// Nuova funzione per popolare le attrezzature e gestire la visualizzazione condizionale
function populateEquipment() {
    const equipmentList = [
        { "name": "stepmill machine", "name_it": "Stair Climber (Scalinata)" },
        { "name": "elliptical machine", "name_it": "Ellittica" },
        { "name": "trap bar", "name_it": "Trap Bar" },
        { "name": "tire", "name_it": "Pneumatico (Tire)" },
        { "name": "stationary bike", "name_it": "Cyclette" },
        { "name": "wheel roller", "name_it": "Ab Wheel (Rullo per addominali)" },
        { "name": "smith machine", "name_it": "Multipower (Smith Machine)" },
        { "name": "hammer", "name_it": "Martello (Sledgehammer)" },
        { "name": "skierg machine", "name_it": "SkiErg" },
        { "name": "roller", "name_it": "Rullo (Foam Roller)" },
        { "name": "resistance band", "name_it": "Fascia elastica" },
        { "name": "bosu ball", "name_it": "Bosu" },
        { "name": "weighted", "name_it": "Con sovraccarico" },
        { "name": "olympic barbell", "name_it": "Bilanciere olimpico" },
        { "name": "kettlebell", "name_it": "Kettlebell" },
        { "name": "upper body ergometer", "name_it": "Ergometro per braccia" },
        { "name": "sled machine", "name_it": "Slitta (Sled)" },
        { "name": "ez barbell", "name_it": "Bilanciere EZ (Sagomato)" },
        { "name": "dumbbell", "name_it": "Manubrio" },
        { "name": "rope", "name_it": "Corda" },
        { "name": "barbell", "name_it": "Bilanciere" },
        { "name": "band", "name_it": "Elastico" },
        { "name": "stability ball", "name_it": "Palla svizzera (Fitball)" },
        { "name": "medicine ball", "name_it": "Palla medica" },
        { "name": "assisted", "name_it": "Assistito" },
        { "name": "leverage machine", "name_it": "Macchina a leva" },
        { "name": "cable", "name_it": "Cavo" },
        { "name": "body weight", "name_it": "A corpo libero" }
    ];

    const container = document.getElementById('equipment-checkbox-group');
    if (!container) return;

    container.innerHTML = '';
    equipmentList.forEach(item => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" name="attrezzatura" value="${item.name_it}"> <span>${item.name_it}</span>`;
        container.appendChild(label);
    });

    // Gestione visualizzazione condizionale
    const equipmentRadios = document.querySelectorAll('input[name="equipment_type"]');
    const customContainer = document.getElementById('custom-equipment-container');

    equipmentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'personalizzato') {
                customContainer.style.display = 'block';
            } else {
                customContainer.style.display = 'none';
            }
        });
    });
}

const bodyParts = [
        { "name": "neck", "name_it": "Collo" },
        { "name": "lower arms", "name_it": "Braccia inferiori" },
        { "name": "shoulders", "name_it": "Spalle" },
        { "name": "cardio", "name_it": "Cardio" },
        { "name": "upper arms", "name_it": "Braccia superiori" },
        { "name": "chest", "name_it": "Petto" },
        { "name": "lower legs", "name_it": "Parte inferiore delle gambe" },
        { "name": "back", "name_it": "Dorso" },
        { "name": "upper legs", "name_it": "Gambe superiori" },
        { "name": "waist", "name_it": "Addominali" }
    ];

    function populateFocus() {
        const focusGroup = document.getElementById('focus-checkbox-group');
        if (!focusGroup) return;

        focusGroup.innerHTML = bodyParts.map(part => `
            <label>
                <input type="checkbox" name="focus_muscolare" value="${part.name}">
                <span>${part.name_it}</span>
            </label>
        `).join('');
    }

    // Toggle custom focus container
    const focusTypeOptions = document.getElementsByName('focus_type');
    const customFocusContainer = document.getElementById('custom-focus-container');
    const focusHint = document.getElementById('focus-hint');

    focusTypeOptions.forEach(option => {
        option.addEventListener('change', (e) => {
            if (e.target.value === 'personalizzato') {
                customFocusContainer.style.display = 'block';
                focusHint.textContent = "Seleziona i gruppi muscolari su cui vuoi concentrarti.";
            } else {
                customFocusContainer.style.display = 'none';
                if (e.target.value === 'full_body_daily') {
                    focusHint.textContent = "Allenamento completo del corpo in ogni sessione.";
                } else {
                    focusHint.textContent = "Focus bilanciato su tutto il corpo durante la settimana.";
                }
            }
        });
    });

    // Inizializza select personalizzate al caricamento
    initCustomSelects();
    populateEquipment();
    populateFocus();

// Update range value display
    const daysRange = document.getElementById('giorni');
    const daysVal = document.getElementById('giorni-val');
    const durationRange = document.getElementById('durata');
    const durationVal = document.getElementById('durata-val');
    
    if (daysRange && daysVal) {
        // Initialize background
        updateSliderBackground(daysRange);
        daysRange.addEventListener('input', (e) => {
            daysVal.textContent = e.target.value;
            updateSliderBackground(e.target);
        });
    }

    function formatDuration(minutes) {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        let hourText = `${hours}h`;
        if (remainingMinutes > 0) {
            hourText += ` ${remainingMinutes}m`;
        }
        return `${minutes} min (${hourText})`;
    }

    if (durationRange && durationVal) {
        // Initialize background
        updateSliderBackground(durationRange);
        durationVal.textContent = formatDuration(durationRange.value);
        durationRange.addEventListener('input', (e) => {
            durationVal.textContent = formatDuration(e.target.value);
            updateSliderBackground(e.target);
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Gather form data
            const formData = new FormData(form);
            const data = {};
            
            // Handle checkboxes specifically for arrays
            const equipment = [];
            const equipmentType = form.querySelector('input[name="equipment_type"]:checked').value;
            
            if (equipmentType === 'personalizzato') {
                const equipmentCheckboxes = form.querySelectorAll('input[name="attrezzatura"]:checked');
                equipmentCheckboxes.forEach(cb => equipment.push(cb.value));
            } else {
                equipment.push(equipmentType);
            }

            const focus = [];
            const focusType = form.querySelector('input[name="focus_type"]:checked').value;
            
            if (focusType === 'personalizzato') {
                const focusCheckboxes = form.querySelectorAll('input[name="focus_muscolare"]:checked');
                focusCheckboxes.forEach(cb => focus.push(cb.value));
            } else {
                focus.push(focusType);
            }
            
            const workoutType = form.querySelector('input[name="workout_type"]').value;
            
            // Collect other fields
            for (let [key, value] of formData.entries()) {
                if (key !== 'attrezzatura' && key !== 'focus' && key !== 'focus_muscolare' && key !== 'focus_type' && key !== 'workout_type') {
                    data[key] = value;
                }
            }
            
            data.attrezzatura = equipment;
            data.focus = focus;
            data.workout_type = workoutType;

            console.log("Form Data Collected:", data);

            // Check plan limits for AI usage
            if (window.PlanManager) {
                if (!window.PlanManager.canUseAI()) {
                    window.PlanManager.showProPopup(`Hai raggiunto il limite di ${window.PlanManager.getCurrentPlan().maxAIRoutines} schede AI per il tuo piano attuale.`);
                    return;
                }
            }

            // Validation
            if (data.focus.length === 0) {
                if (window.showErrorToast) {
                    window.showErrorToast("Seleziona almeno un focus muscolare o 'Full Body'.");
                }
                return;
            }
            
            if (data.attrezzatura.length === 0) {
                if (window.showErrorToast) {
                    window.showErrorToast("Seleziona almeno un tipo di attrezzatura o un'opzione valida.");
                }
                return;
            }

            try {
                // Show loading state for AI generation
                window.LoadingManager.showAIGeneration();
                
                // 1. Load and Filter Database
                window.LoadingManager.nextStep('Caricamento database esercizi...');
                const exercises = await loadAndFilterExercises(data.attrezzatura, data);
                
                if (exercises.names.length === 0) {
                    throw new Error("Nessun esercizio trovato con l'attrezzatura selezionata.");
                }

                // 2. Call Gemini API
                window.LoadingManager.nextStep('Generazione scheda con AI...');
                const generatedRoutine = await generateRoutineWithGemini(data, exercises);
                
                // 3. Process Response & Map to Full Objects
                window.LoadingManager.nextStep('Elaborazione esercizi...');
                const finalRoutine = mapRoutineToFullObjects(generatedRoutine, exercises.fullList);

                // 4. Update AI usage counter in Firestore and Cache
                try {
                    const user = firebase.auth().currentUser;
                    const profile = window.PlanManager.getUserProfile();
                    if (user && profile) {
                        const usage = profile.ai_usage || { count: 0, lastReset: null };
                        const plan = window.PlanManager.getCurrentPlan();
                        
                        let newCount = usage.count + 1;
                        let lastReset = usage.lastReset;
                        
                        // Reset if monthly and period changed
                        if (plan.isMonthlyAI && window.PlanManager._shouldResetAIUsage(lastReset)) {
                            newCount = 1;
                            lastReset = new Date().toISOString();
                        } else if (!lastReset) {
                            lastReset = new Date().toISOString();
                        }

                        const newUsage = { count: newCount, lastReset: lastReset };
                        
                        // Update Firestore
                        await db.collection('users').doc(user.uid).update({
                            ai_usage: newUsage
                        });
                        
                        // Update Cache
                        profile.ai_usage = newUsage;
                        localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(profile));
                        console.log('AI usage updated:', newUsage);
                    }
                } catch (usageError) {
                    console.error("Error updating AI usage:", usageError);
                }

                // 5. Export/Save
                window.LoadingManager.nextStep('Preparazione download...');
                exportRoutineToPDF(finalRoutine);

            } catch (error) {
                console.error("Errore durante la generazione:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Si è verificato un errore: " + error.message);
                }
            } finally {
                window.LoadingManager.hide();
            }
        });
    }

    // --- Helper Functions ---

    async function loadAndFilterExercises(selectedEquipment, userData) {
        try {
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            if (!response.ok) throw new Error("Impossibile caricare il database esercizi.");
            
            const allExercises = await response.json();
            
            // Logica di filtraggio in base alla selezione
            let filtered;
            
            if (selectedEquipment.includes('palestra')) {
                // Se 'palestra' è selezionato, include tutto
                filtered = allExercises;
            } else if (selectedEquipment.includes('corpo_libero')) {
                // Se 'corpo_libero' è selezionato, filtra per "A corpo libero"
                filtered = allExercises.filter(ex => {
                    if (!ex.equipments_it) return false;
                    return ex.equipments_it.some(eq => eq === 'A corpo libero');
                });
            } else {
                // Caso 'personalizzato': usa la lista di attrezzature selezionate
                filtered = allExercises.filter(ex => {
                    if (!ex.equipments_it) return false;
                    return ex.equipments_it.some(eq => selectedEquipment.includes(eq));
                });
            }

            // --- MIGLIORAMENTO SCIENTIFICO ---
            // Se l'obiettivo è dimagrimento, assicuriamoci che ci siano esercizi cardio 
            // anche se l'attrezzatura selezionata non li includerebbe esplicitamente
            if (userData.obiettivo === 'dimagrimento') {
                const cardioExercises = allExercises.filter(ex => 
                    ex.bodyParts_it && ex.bodyParts_it.some(bp => bp.toLowerCase().includes('cardio'))
                );
                
                // Aggiungi un set di esercizi cardio (limitati a 10 per non appesantire)
                const extraCardio = cardioExercises.slice(0, 10);
                extraCardio.forEach(ce => {
                    if (!filtered.find(f => f.exerciseId === ce.exerciseId)) {
                        filtered.push(ce);
                    }
                });
            }

            return {
                names: filtered.map(ex => ex.name_it),
                fullList: filtered
            };

        } catch (error) {
            console.error("Load exercises error:", error);
            throw error;
        }
    }

    async function generateRoutineWithGemini(userData, exercises) {
        try {
            // Chiama la Cloud Function Firebase (SICURA - chiave API nel backend)
            // Specifichiamo la regione 'us-central1' per sicurezza e un timeout maggiore (3 minuti)
            const cloudFunction = firebase.app().functions('us-central1').httpsCallable('generateWorkoutRoutine', { timeout: 180000 });
            
            console.log("Chiamando Cloud Function...");
            
            const result = await cloudFunction({
                userData: userData,
                exerciseNames: exercises.names
            });

            console.log("Scheda generata con successo!");
            return result.data.routine;

        } catch (error) {
            console.error("Errore nella generazione della scheda:", error);
            
            let errorMessage = "Non è stato possibile generare la scheda.\n\n";
            
            if (error.code === 'resource-exhausted') {
                errorMessage = "riprovare perche si e verificato un problema";
            } else if (error.code === 'unauthenticated') {
                errorMessage += "Errore di autenticazione. Per favore, accedi di nuovo.";
            } else {
                errorMessage += "Errore: " + (error.message || 'Sconosciuto');
            }
            
            throw new Error(errorMessage);
        }
    }

    function mapRoutineToFullObjects(routine, fullList) {
        // Map simplified names back to full objects
        routine.sedute.forEach(seduta => {
            seduta.esercizi = seduta.esercizi.map(ex => {
                // Find matching exercise in fullList (case-insensitive and trimmed)
                let exName = (ex.nome || '').trim().toLowerCase();
                
                // Cleanup AI name: remove common patterns like "(...)", " - ...", " 3x10" etc.
                const cleanName = exName.replace(/\(.*\)/g, '')
                                       .replace(/\d+x\d+/g, '')
                                       .replace(/\d+\s*serie/g, '')
                                       .replace(/\d+\s*ripetizioni/g, '')
                                       .trim();

                let match = fullList.find(dbEx => {
                    const dbName = (dbEx.name_it || '').trim().toLowerCase();
                    return dbName === exName || dbName === cleanName;
                });
                
                // If still no match, try partial matching
                if (!match) {
                    match = fullList.find(dbEx => {
                        const dbName = (dbEx.name_it || '').trim().toLowerCase();
                        return exName.includes(dbName) || dbName.includes(exName);
                    });
                }
                
                if (match) {
                    return {
                        ...ex,
                        nome: match.name_it, // Use exact name from DB
                        originalData: {
                            id: match.exerciseId,
                            gifUrl: match.gifUrl,
                            instructions: match.instructions_it
                        }
                    };
                } else {
                    console.warn(`Esercizio non trovato nel database: ${ex.nome}`);
                }
                return ex; // Return as is if not found
            });
        });
        return routine;
    }

    function exportRoutineToPDF(routineData) {
        console.log("Dati pronti per esportazione al crea_scheda:", routineData);
        
        // Salva i dati in sessionStorage  
        sessionStorage.setItem('aiGeneratedRoutine', JSON.stringify(routineData));
        
        // Redirect a crea_scheda.js
        window.location.href = '../crea_scheda/crea_scheda.html';
    }
});
