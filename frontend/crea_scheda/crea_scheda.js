document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage ? firebase.storage() : null; // Storage might not be initialized in the HTML

    const loadingScreen = document.getElementById('loading-screen');
    const saveBtn = document.getElementById('save-button');
    const nomeSchedaInput = document.getElementById('nome-scheda');

    const datePickerTrigger = document.getElementById('date-picker-trigger');
    const dateRangeDisplay = document.getElementById('date-range-display');
    const seduteContainer = document.getElementById('sedute-container');
    const addSedutaBtn = document.getElementById('add-seduta-button');

    // Initialize SortableJS for sedute
    if (typeof Sortable !== 'undefined') {
        new Sortable(seduteContainer, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: () => {
                updateSeduteNumbers();
            }
        });
    }

    // Calendar elements
    const calendarModal = document.getElementById('calendar-modal');
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYear = document.getElementById('current-month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const closeCalendarBtn = document.getElementById('close-calendar');
    const confirmDateBtn = document.getElementById('confirm-date');

    let currentUser = null;
    let selectedStartDate = null;
    let selectedEndDate = null;
    let currentCalendarDate = new Date();
    let seduteCount = 1;

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

    // Optimistic Load: Render immediately if we have a known user
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        console.log("Optimistic load for create routine:", lastUid);
        loadUserPreferences(lastUid);
        // waitForSidebar(); // Sidebar loading is independent
    }

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        if (user) {
            try {
                currentUser = user;
                
                // Update lastUserId
                if (user.uid !== lastUid) {
                    localStorage.setItem('lastUserId', user.uid);
                }

                await Promise.all([
                    loadUserPreferences(user.uid),
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

    async function loadUserPreferences(uid) {
        if (!window.CacheManager) return;
        
        // 1. Try Cache
        const prefs = window.CacheManager.getPreferences(uid);
        if (prefs && prefs.color) {
            setPrimaryColor(prefs.color);
            return;
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
                    window.CacheManager.savePreferences(uid, data.preferences);
                }
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
        }
    }

    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }



    // --- Calendar Logic ---
    datePickerTrigger.addEventListener('click', (e) => {
        // Reset positioning styles to ensure centering works
        const modalContent = calendarModal.querySelector('.modal-content');
        modalContent.style.position = '';
        modalContent.style.top = '';
        modalContent.style.left = '';
        modalContent.style.transform = '';
        modalContent.style.margin = '';

        calendarModal.classList.add('active');
        renderCalendar();
    });

    // Close modal when clicking outside content
    calendarModal.addEventListener('click', (e) => {
        if (e.target === calendarModal) {
            calendarModal.classList.remove('active');
        }
    });

    closeCalendarBtn.addEventListener('click', () => {
        calendarModal.classList.remove('active');
    });

    prevMonthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
                           "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        currentMonthYear.textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Adjust first day (Monday as first day of week)
        let adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        for (let i = 0; i < adjustedFirstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyDiv);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.textContent = day;

            const dateObj = new Date(year, month, day);
            dateObj.setHours(0, 0, 0, 0); // Normalize time for comparison
            
            if (selectedStartDate && dateObj.getTime() === selectedStartDate.getTime()) {
                dayDiv.classList.add('selected');
            } else if (selectedEndDate && dateObj.getTime() === selectedEndDate.getTime()) {
                dayDiv.classList.add('selected');
            } else if (selectedStartDate && selectedEndDate && dateObj > selectedStartDate && dateObj < selectedEndDate) {
                dayDiv.classList.add('in-range');
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dateObj.getTime() === today.getTime()) {
                dayDiv.classList.add('today');
            }

            dayDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
                    selectedStartDate = new Date(dateObj);
                    selectedEndDate = null;
                } else if (dateObj < selectedStartDate) {
                    selectedStartDate = new Date(dateObj);
                } else {
                    selectedEndDate = new Date(dateObj);
                }
                renderCalendar();
            });

            calendarGrid.appendChild(dayDiv);
        }
    }

    confirmDateBtn.addEventListener('click', () => {
        if (selectedStartDate || selectedEndDate) {
            const options = { day: 'numeric', month: 'short', year: 'numeric' };
            if (selectedStartDate && selectedEndDate) {
                dateRangeDisplay.textContent = `${selectedStartDate.toLocaleDateString('it-IT', options)} - ${selectedEndDate.toLocaleDateString('it-IT', options)}`;
            } else {
                dateRangeDisplay.textContent = selectedStartDate.toLocaleDateString('it-IT', options);
            }
            dateRangeDisplay.classList.add('date-set');
            calendarModal.classList.remove('active');
        }
    });

    // --- Sessions Logic ---
    let sedutaToDelete = null;
    let exerciseToReplace = null; // Global variable to track exercise replacement

    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    function createExerciseRowHTML(exercise) {
        return `
            <div class="col-drag exercise-drag-handle">
                <i class="fas fa-grip-lines"></i>
            </div>
            <div class="col-name">
                <input type="text" class="exercise-input name-input" value="${exercise.name_it || exercise.name}" readonly title="${exercise.name_it || exercise.name}">
            </div>
            <div class="col-rep">
                <div class="number-input-wrapper">
                    <input type="number" min="0" class="exercise-input center-text empty-placeholder" value="" placeholder="-" onkeypress="return (event.charCode >= 48 && event.charCode <= 57)">
                    <div class="spin-btns">
                        <button class="spin-btn spin-up"><i class="fas fa-chevron-up"></i></button>
                        <button class="spin-btn spin-down"><i class="fas fa-chevron-down"></i></button>
                    </div>
                </div>
            </div>
            <div class="col-set">
                <div class="number-input-wrapper">
                    <input type="number" min="0" class="exercise-input center-text empty-placeholder" value="" placeholder="-" onkeypress="return (event.charCode >= 48 && event.charCode <= 57)">
                    <div class="spin-btns">
                        <button class="spin-btn spin-up"><i class="fas fa-chevron-up"></i></button>
                        <button class="spin-btn spin-down"><i class="fas fa-chevron-down"></i></button>
                    </div>
                </div>
            </div>
            <div class="col-rest">
                <div class="input-with-unit">
                    <div class="number-input-wrapper">
                        <input type="number" min="0" class="exercise-input center-text" value="30" onkeypress="return (event.charCode >= 48 && event.charCode <= 57)">
                        <div class="spin-btns">
                            <button class="spin-btn spin-up"><i class="fas fa-chevron-up"></i></button>
                            <button class="spin-btn spin-down"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <span class="unit-label">Sec</span>
                </div>
            </div>
            <div class="col-weight">
                <div class="input-with-unit">
                    <div class="number-input-wrapper">
                        <input type="number" min="0" class="exercise-input center-text empty-placeholder" value="" placeholder="-" onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.key === '.'">
                        <div class="spin-btns">
                            <button class="spin-btn spin-up"><i class="fas fa-chevron-up"></i></button>
                            <button class="spin-btn spin-down"><i class="fas fa-chevron-down"></i></button>
                        </div>
                    </div>
                    <span class="unit-label">kg</span>
                </div>
            </div>
            <div class="col-note">
                <textarea class="exercise-input note-input"></textarea>
            </div>
            <div class="col-photo">
                <img src="${exercise.gifUrl}" alt="${exercise.name}" loading="lazy">
            </div>
            <div class="col-actions">
                <button class="exercise-menu-trigger">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                <div class="exercise-menu-dropdown">
                    <button class="menu-item create-superset">
                        <i class="fas fa-layer-group"></i> Crea Superset
                    </button>
                    <button class="menu-item move-exercise-up">
                        <i class="fas fa-arrow-up"></i> Sposta in su
                    </button>
                    <button class="menu-item move-exercise-down">
                        <i class="fas fa-arrow-down"></i> Sposta in giù
                    </button>
                    <button class="menu-item duplicate-exercise">
                        <i class="far fa-copy"></i> Duplica
                    </button>
                    <button class="menu-item delete delete-exercise">
                        <i class="far fa-trash-alt"></i> Elimina
                    </button>
                </div>
            </div>
        `;
    }

    function initExerciseRowEvents(exerciseRow, exerciseData) {
        const nameInput = exerciseRow.querySelector('.name-input');
        const menuTrigger = exerciseRow.querySelector('.exercise-menu-trigger');
        const dropdown = exerciseRow.querySelector('.exercise-menu-dropdown');
        const deleteBtn = exerciseRow.querySelector('.delete-exercise');
        const duplicateBtn = exerciseRow.querySelector('.duplicate-exercise');
        const createSupersetBtn = exerciseRow.querySelector('.create-superset');
        const moveUpBtn = exerciseRow.querySelector('.move-exercise-up');
        const moveDownBtn = exerciseRow.querySelector('.move-exercise-down');

        // Task 2: Click on name opens modal to replace exercise
        nameInput.addEventListener('click', () => {
             exerciseToReplace = exerciseRow;
             const sedutaCard = exerciseRow.closest('.seduta-card');
             const sedutaId = sedutaCard ? sedutaCard.dataset.sedutaId : null;
             
             if (window.AddExerciseModal && sedutaId) {
                 window.AddExerciseModal.open(sedutaId);
             } else {
                 console.error("Cannot open modal: missing modal or sedutaId");
             }
        });

        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other dropdowns (both exercise and seduta)
            document.querySelectorAll('.exercise-menu-dropdown, .seduta-menu-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        });
        
        // Fix hover color bug via CSS, but ensure click works
        menuTrigger.addEventListener('mouseenter', () => {
            // Logic handled in CSS
        });

        deleteBtn.addEventListener('click', () => {
            const parent = exerciseRow.parentNode;
            exerciseRow.remove();
            
            // Check if parent is a superset container and handle cleanup
            if (parent.classList.contains('superset-exercises-list')) {
                const wrapper = parent.closest('.superset-wrapper');
                const remaining = parent.children.length;
                if (remaining === 0) {
                    wrapper.remove();
                } else if (remaining === 1) {
                    // Unwrap the last exercise
                    const lastExercise = parent.firstElementChild;
                    wrapper.parentNode.insertBefore(lastExercise, wrapper);
                    wrapper.remove();
                }
            }
        });

        duplicateBtn.addEventListener('click', () => {
             const clone = exerciseRow.cloneNode(true);
             // Ensure dropdown is closed in clone
             const cloneDropdown = clone.querySelector('.exercise-menu-dropdown');
             if (cloneDropdown) cloneDropdown.classList.remove('active');
             
             exerciseRow.parentNode.insertBefore(clone, exerciseRow.nextSibling);
             
             // Close original dropdown
             dropdown.classList.remove('active');
             
             // Re-initialize events for clone
             initExerciseRowEvents(clone, null);
        });

        createSupersetBtn.addEventListener('click', () => {
            const parent = exerciseRow.parentNode;
            const dropdown = exerciseRow.querySelector('.exercise-menu-dropdown');
            
            // Check if already in superset
            if (parent.classList.contains('superset-exercises-list')) {
                 // Already in superset: Duplicate and append
                 const clone = exerciseRow.cloneNode(true);
                 // Reset inputs in clone? The user said "identico a quello sopra", so keep values.
                 
                 // Ensure dropdown is closed in clone
                 const cloneDropdown = clone.querySelector('.exercise-menu-dropdown');
                 if (cloneDropdown) cloneDropdown.classList.remove('active');
                 
                 // Insert after current row
                 if (exerciseRow.nextSibling) {
                    parent.insertBefore(clone, exerciseRow.nextSibling);
                 } else {
                    parent.appendChild(clone);
                 }
                 
                 dropdown.classList.remove('active');
                 initExerciseRowEvents(clone, null);
            } else {
                 // Not in superset: Create wrapper
                 const wrapper = document.createElement('div');
                 wrapper.className = 'superset-wrapper';
                 
                 const dragHandle = document.createElement('div');
                 dragHandle.className = 'superset-drag-handle';
                 dragHandle.innerHTML = '<i class="fas fa-grip-lines"></i>';
                 
                 const list = document.createElement('div');
                 list.className = 'superset-exercises-list';
                 
                 // Insert wrapper before current row
                 parent.insertBefore(wrapper, exerciseRow);
                 
                 // Move current row into list
                 list.appendChild(exerciseRow);
                 
                 // Create duplicate
                 const clone = exerciseRow.cloneNode(true);
                 const cloneDropdown = clone.querySelector('.exercise-menu-dropdown');
                 if (cloneDropdown) cloneDropdown.classList.remove('active');
                 
                 list.appendChild(clone);
                 
                 wrapper.appendChild(dragHandle);
                 wrapper.appendChild(list);
                 
                 dropdown.classList.remove('active');
                 initExerciseRowEvents(clone, null);
            }
        });

        moveUpBtn.addEventListener('click', () => {
            const prev = exerciseRow.previousElementSibling;
            if (prev) {
                exerciseRow.parentNode.insertBefore(exerciseRow, prev);
            }
            dropdown.classList.remove('active');
        });

        moveDownBtn.addEventListener('click', () => {
            const next = exerciseRow.nextElementSibling;
            if (next) {
                exerciseRow.parentNode.insertBefore(next, exerciseRow);
            }
            dropdown.classList.remove('active');
        });
    }

    function createSedutaHTML(id) {
        return `
            <div class="drag-handle">
                <i class="fas fa-grip-lines"></i>
            </div>
            <div class="seduta-header">
                <div class="seduta-title-container">
                    <button class="collapse-seduta-btn"><i class="fas fa-chevron-down"></i></button>
                    <h3 class="section-label" contenteditable="false" data-custom-name="false">Seduta ${id}</h3>
                    <div class="seduta-summary">
                        <!-- Summary content will be populated via JS -->
                    </div>
                </div>
                <button class="seduta-menu-trigger">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="seduta-menu-dropdown">
                    <button class="menu-item rename-seduta">
                        <i class="fas fa-edit"></i> Rinomina Seduta
                    </button>
                    <button class="menu-item move-up">
                        <i class="fas fa-arrow-up"></i> Sposta in su
                    </button>
                    <button class="menu-item move-down">
                        <i class="fas fa-arrow-down"></i> Sposta in giù
                    </button>
                    <button class="menu-item copy-seduta">
                        <i class="far fa-copy"></i> Copia Seduta
                    </button>
                    <button class="menu-item delete delete-seduta">
                        <i class="far fa-trash-alt"></i> Elimina Seduta
                    </button>
                </div>
            </div>
            <div class="seduta-body">
                <div class="seduta-exercises-header">
                    <span class="header-col col-drag-spacer"></span>
                    <span class="header-col col-name">Esercizio</span>
                    <span class="header-col col-rep">Rep</span>
                    <span class="header-col col-set">Serie</span>
                    <span class="header-col col-rest">Recupero</span>
                    <span class="header-col col-weight">Peso (kg)</span>
                    <span class="header-col col-note">Nota</span>
                    <span class="header-col col-photo">Foto</span>
                    <span class="header-col col-actions"></span>
                </div>
                <div class="seduta-content">
                    <div class="exercises-list"></div>
                    <button class="add-exercise-btn">
                        <i class="fas fa-plus"></i> Aggiungi Esercizio
                    </button>
                </div>
            </div>
        `;
    }

    function initSedutaEvents(card) {
        const menuTrigger = card.querySelector('.seduta-menu-trigger');
        const dropdown = card.querySelector('.seduta-menu-dropdown');
        const renameBtn = card.querySelector('.rename-seduta');
        const moveUpBtn = card.querySelector('.move-up');
        const moveDownBtn = card.querySelector('.move-down');
        const copyBtn = card.querySelector('.copy-seduta');
        const deleteBtn = card.querySelector('.delete-seduta');
        const label = card.querySelector('.section-label');
        const collapseBtn = card.querySelector('.collapse-seduta-btn');
        const sedutaBody = card.querySelector('.seduta-body');
        
        // Initialize Sortable for exercises in this session
        const exercisesList = card.querySelector('.exercises-list');
        if (exercisesList && typeof Sortable !== 'undefined') {
            new Sortable(exercisesList, {
                animation: 150,
                handle: '.exercise-drag-handle, .superset-drag-handle',
                ghostClass: 'sortable-ghost'
            });
        }

        if (collapseBtn && sedutaBody) {
            collapseBtn.addEventListener('click', () => {
                collapseBtn.classList.toggle('collapsed');
                const summary = card.querySelector('.seduta-summary');
                
                if (sedutaBody.style.display === 'none') {
                    sedutaBody.style.display = 'block';
                    if (summary) summary.style.display = 'none';
                } else {
                    sedutaBody.style.display = 'none';
                    updateSedutaSummary(card);
                    if (summary) summary.style.display = 'flex';
                }
            });
        }

        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other dropdowns (both exercise and seduta)
            document.querySelectorAll('.seduta-menu-dropdown, .exercise-menu-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        });

        renameBtn.addEventListener('click', () => {
            const oldName = label.textContent.trim();
            label.contentEditable = "true";
            label.focus();
            
            // Place cursor at the end instead of selecting everything
            const range = document.createRange();
            range.selectNodeContents(label);
            range.collapse(false); // false means collapse to end
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            const handleBlur = () => {
                label.contentEditable = "false";
                const newName = label.textContent.trim();
                if (newName === "") {
                    label.textContent = oldName;
                } else {
                    if (/^Seduta \d+$/.test(newName)) {
                        label.dataset.customName = "false";
                    } else {
                        label.dataset.customName = "true";
                    }
                }
            };

            label.addEventListener('blur', handleBlur, { once: true });

            label.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    label.blur();
                }
            });
            dropdown.classList.remove('active');
        });

        moveUpBtn.addEventListener('click', () => {
            const prev = card.previousElementSibling;
            if (prev && prev.classList.contains('seduta-card')) {
                seduteContainer.insertBefore(card, prev);
                updateSeduteNumbers();
            }
            dropdown.classList.remove('active');
        });

        moveDownBtn.addEventListener('click', () => {
            const next = card.nextElementSibling;
            if (next && next.classList.contains('seduta-card')) {
                seduteContainer.insertBefore(next, card);
                updateSeduteNumbers();
            }
            dropdown.classList.remove('active');
        });

        copyBtn.addEventListener('click', () => {
            duplicateSeduta(card);
            dropdown.classList.remove('active');
        });

        deleteBtn.addEventListener('click', () => {
            sedutaToDelete = card;
            deleteConfirmModal.classList.add('active');
            dropdown.classList.remove('active');
        });
    }

    function duplicateSeduta(originalCard) {
        seduteCount++;
        const newCard = document.createElement('div');
        newCard.className = 'card-section seduta-card';
        newCard.dataset.sedutaId = seduteCount;
        newCard.innerHTML = createSedutaHTML(seduteCount);
        
        // Copy exercises if they exist (assuming they are in .seduta-content)
        // For now, it just creates a new empty session as the exercise structure isn't fully shown here
        
        seduteContainer.appendChild(newCard);
        initSedutaEvents(newCard);
        updateSeduteNumbers();
    }

    function updateSedutaSummary(card) {
        const exercises = card.querySelectorAll('.exercise-row');
        const count = exercises.length;
        const muscleCounts = {};
        
        exercises.forEach(row => {
            const muscles = (row.dataset.muscles || "").split(',').filter(m => m);
            muscles.forEach(m => {
                muscleCounts[m] = (muscleCounts[m] || 0) + 1;
            });
        });
        
        let mainMuscle = "-";
        if (Object.keys(muscleCounts).length > 0) {
            mainMuscle = Object.entries(muscleCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0];
            // Capitalize first letter
            mainMuscle = mainMuscle.charAt(0).toUpperCase() + mainMuscle.slice(1);
        }
        
        const summary = card.querySelector('.seduta-summary');
        if (summary) {
            summary.innerHTML = `
                <span class="summary-item"><i class="fas fa-dumbbell"></i> ${count} Esercizi</span>
                <span class="summary-item"><i class="fas fa-running"></i> ${mainMuscle}</span>
            `;
        }
    }

    function updateSeduteNumbers() {
        const cards = seduteContainer.querySelectorAll('.seduta-card');
        cards.forEach((card, index) => {
            const label = card.querySelector('.section-label');
            const currentName = label.textContent.trim();
            const isCustom = label.dataset.customName === "true";

            // Solo se il nome è del tipo "Seduta N" (e non custom) o vuoto, lo aggiorniamo
            if (!isCustom && (/^Seduta \d+$/.test(currentName) || currentName === "")) {
                label.textContent = `Seduta ${index + 1}`;
            }
            card.dataset.sedutaId = index + 1;
        });
        seduteCount = cards.length;
    }

    // Initialize events for existing sessions
    document.querySelectorAll('.seduta-card').forEach(initSedutaEvents);

    addSedutaBtn.addEventListener('click', () => {
        seduteCount++;
        const sedutaCard = document.createElement('div');
        sedutaCard.className = 'card-section seduta-card';
        sedutaCard.dataset.sedutaId = seduteCount;
        sedutaCard.innerHTML = createSedutaHTML(seduteCount);
        seduteContainer.appendChild(sedutaCard);
        initSedutaEvents(sedutaCard);
    });

    confirmDeleteBtn.addEventListener('click', () => {
        if (sedutaToDelete) {
            sedutaToDelete.remove();
            updateSeduteNumbers();
            deleteConfirmModal.classList.remove('active');
            sedutaToDelete = null;
        }
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteConfirmModal.classList.remove('active');
        sedutaToDelete = null;
    });

    // Close dropdowns on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.seduta-menu-dropdown').forEach(d => d.classList.remove('active'));
    });

    // --- Save Logic ---
    saveBtn.addEventListener('click', async () => {
        const nome = nomeSchedaInput.value.trim();
        if (!nome) {
            alert('Inserisci un nome per la scheda');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvataggio...';

        try {
            // Collect sedute and exercises data
            const seduteData = [];
            const sedutaCards = document.querySelectorAll('.seduta-card');

            sedutaCards.forEach((card, index) => {
                const sedutaLabel = card.querySelector('.section-label').textContent.trim();
                const exercises = [];
                const exerciseRows = card.querySelectorAll('.exercise-row');

                exerciseRows.forEach(row => {
                    const name = row.querySelector('.col-name input').value;
                    const reps = row.querySelector('.col-rep input').value;
                    const sets = row.querySelector('.col-set input').value;
                    const rest = row.querySelector('.col-rest input').value;
                    const weight = row.querySelector('.col-weight input').value;
                    const note = row.querySelector('.col-note textarea').value;
                    const photo = row.querySelector('.col-photo img').src;
                    const exerciseId = row.dataset.exerciseId;

                    exercises.push({
                        exerciseId: exerciseId,
                        name: name,
                        reps: reps,
                        sets: sets,
                        rest: rest,
                        weight: weight,
                        note: note,
                        photo: photo
                    });
                });

                seduteData.push({
                    id: index + 1, // Or card.dataset.sedutaId
                    name: sedutaLabel,
                    exercises: exercises
                });
            });

            const routineData = {
                userId: currentUser.uid,
                name: nome,
                startDate: selectedStartDate ? firebase.firestore.Timestamp.fromDate(selectedStartDate) : null,
                endDate: selectedEndDate ? firebase.firestore.Timestamp.fromDate(selectedEndDate) : null,
                sedute: seduteCount,
                seduteData: seduteData, // Add the detailed data here
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('routines').add(routineData);

            // Update Local Cache immediately
            try {
                if (window.CacheManager) {
                    const newRoutineForCache = {
                        ...routineData,
                        id: docRef.id,
                        // Use current date for cache instead of serverTimestamp placeholder
                        createdAt: { toDate: () => new Date() },
                        startDate: selectedStartDate ? { toDate: () => selectedStartDate } : null,
                        endDate: selectedEndDate ? { toDate: () => selectedEndDate } : null
                    };
                    window.CacheManager.updateRoutine(currentUser.uid, newRoutineForCache);
                }
            } catch (cacheError) {
                console.error("Error updating local cache:", cacheError);
            }

            alert('Scheda salvata con successo!');
            window.location.href = '../lista_schede/lista_scheda.html';
        } catch (error) {
            console.error("Error saving routine:", error);
            alert('Errore durante il salvataggio. Riprova.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salva';
        }
    });

    // --- ADD EXERCISE LOGIC START ---
    
    // Load Add Exercise Modal HTML
    fetch('../templates/aggiungi_esercizio/aggiungi_esercizio.html')
        .then(response => response.text())
        .then(html => {
            document.body.insertAdjacentHTML('beforeend', html);
            if (window.AddExerciseModal) {
                window.AddExerciseModal.init();
            }
        })
        .catch(err => console.error('Failed to load add exercise modal:', err));

    // Handle exercise selection from modal
    document.addEventListener('exercise-selected', (e) => {
        const { exercise, sedutaId } = e.detail;
        
        // Find the seduta card
        const sedutaCard = document.querySelector(`.seduta-card[data-seduta-id="${sedutaId}"]`);
        if (!sedutaCard) {
            console.error('Seduta card not found for ID:', sedutaId);
            return;
        }

        const exercisesList = sedutaCard.querySelector('.exercises-list');
        
        // Create the exercise row
        const exerciseRow = document.createElement('div');
        exerciseRow.className = 'exercise-row';
        exerciseRow.dataset.exerciseId = exercise.exerciseId; // Use ID from exercise data
        
        // Muscle fallback logic
        let muscles = [];
        if (exercise.targetMuscles_it && exercise.targetMuscles_it.length > 0) {
            muscles = exercise.targetMuscles_it;
        } else if (exercise.bodyParts_it && exercise.bodyParts_it.length > 0) {
            muscles = exercise.bodyParts_it;
        } else if (exercise.targetMuscles && exercise.targetMuscles.length > 0) {
            muscles = exercise.targetMuscles;
        } else if (exercise.bodyParts && exercise.bodyParts.length > 0) {
            muscles = exercise.bodyParts;
        }
        
        exerciseRow.dataset.muscles = muscles.join(',');
        
        // Use the shared function to generate HTML
        exerciseRow.innerHTML = createExerciseRowHTML(exercise);

        if (exerciseToReplace && exerciseToReplace.closest('.seduta-card') === sedutaCard) {
            // Replace existing exercise
            exerciseToReplace.replaceWith(exerciseRow);
            exerciseToReplace = null; // Reset
        } else {
            // Append new exercise
            exercisesList.appendChild(exerciseRow);
        }

        // Initialize events
        initExerciseRowEvents(exerciseRow, exercise);
    });

    // Delegate click for Add Exercise buttons
    if (seduteContainer) {
        seduteContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-exercise-btn');
            if (btn) {
                const card = btn.closest('.seduta-card');
                if (card) {
                    const sedutaId = card.dataset.sedutaId;
                    if (window.AddExerciseModal) {
                        window.AddExerciseModal.open(sedutaId);
                    } else {
                        console.error("AddExerciseModal not available");
                    }
                }
            }
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.exercise-menu-trigger') && !e.target.closest('.exercise-menu-dropdown') &&
            !e.target.closest('.seduta-menu-trigger') && !e.target.closest('.seduta-menu-dropdown')) {
            document.querySelectorAll('.exercise-menu-dropdown.active, .seduta-menu-dropdown.active').forEach(d => {
                d.classList.remove('active');
            });
        }
    });

    // --- SPIN BUTTONS DELEGATION ---
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.spin-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            
            const wrapper = btn.closest('.number-input-wrapper');
            if (!wrapper) return;
            
            const input = wrapper.querySelector('input');
            if (!input) return;

            const step = input.step && input.step !== 'any' ? parseFloat(input.step) : 1;
            const min = input.min ? parseFloat(input.min) : -Infinity;
            const max = input.max ? parseFloat(input.max) : Infinity;
            
            let val = parseFloat(input.value);
            if (isNaN(val)) val = 0;
            
            if (btn.classList.contains('spin-up')) {
                val += step;
            } else {
                val -= step;
            }
            
            // Clamp
            if (val < min) val = min;
            if (val > max) val = max;
            
            input.value = val;
            
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // --- ADD EXERCISE LOGIC END ---
});
