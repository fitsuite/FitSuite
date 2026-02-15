document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage ? firebase.storage() : null; // Storage might not be initialized in the HTML

    const loadingScreen = document.getElementById('loading-screen');
    const saveBtn = document.getElementById('save-button');
    const nomeSchedaInput = document.getElementById('nome-scheda');
    const logoInput = document.getElementById('logo-input');
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
    let selectedLogoFile = null;

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

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserPreferences(user.uid);
            loadingScreen.style.display = 'none';
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    async function loadUserPreferences(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences && data.preferences.color) {
                    setPrimaryColor(data.preferences.color);
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

    // --- Logo Upload ---
    logoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            selectedLogoFile = e.target.files[0];
            const uploadBtn = document.querySelector('.upload-btn');
            uploadBtn.innerHTML = `<i class="fas fa-check"></i> Logo Caricato`;
            uploadBtn.style.background = '#2d5a27'; // Success green
        }
    });

    // --- Calendar Logic ---
    datePickerTrigger.addEventListener('click', (e) => {
        const rect = datePickerTrigger.getBoundingClientRect();
        const modalContent = calendarModal.querySelector('.modal-content');
        
        // Position the modal content relative to the trigger
        if (window.innerWidth > 768) {
            modalContent.style.position = 'absolute';
            modalContent.style.top = `${rect.bottom + window.scrollY + 10}px`;
            modalContent.style.left = `${rect.left + window.scrollX}px`;
            modalContent.style.transform = 'none';
            modalContent.style.margin = '0';
        }

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
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    function createSedutaHTML(id) {
        return `
            <div class="drag-handle">
                <i class="fas fa-grip-lines"></i>
                <i class="fas fa-grip-lines"></i>
            </div>
            <div class="seduta-header">
                <div class="seduta-title-container">
                    <h3 class="section-label" contenteditable="false">Seduta ${id}</h3>
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
            <div class="seduta-content">
                <button class="add-exercise-btn">
                    <i class="fas fa-plus"></i> Aggiungi Esercizio
                </button>
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

        menuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns
            document.querySelectorAll('.seduta-menu-dropdown').forEach(d => {
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

    function updateSeduteNumbers() {
        const cards = seduteContainer.querySelectorAll('.seduta-card');
        cards.forEach((card, index) => {
            const label = card.querySelector('.section-label');
            const currentName = label.textContent.trim();
            // Solo se il nome è del tipo "Seduta N" o vuoto, lo aggiorniamo
            if (/^Seduta \d+$/.test(currentName) || currentName === "") {
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
            let logoUrl = '';
            if (selectedLogoFile && storage) {
                const logoRef = storage.ref(`logos/${currentUser.uid}/${Date.now()}_${selectedLogoFile.name}`);
                const uploadTask = await logoRef.put(selectedLogoFile);
                logoUrl = await uploadTask.ref.getDownloadURL();
            }

            const routineData = {
                userId: currentUser.uid,
                name: nome,
                logoUrl: logoUrl,
                startDate: selectedStartDate ? firebase.firestore.Timestamp.fromDate(selectedStartDate) : null,
                endDate: selectedEndDate ? firebase.firestore.Timestamp.fromDate(selectedEndDate) : null,
                sedute: seduteCount,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('routines').add(routineData);
            alert('Scheda salvata con successo!');
            window.location.href = '../lista_schede/lista_scheda.html';
        } catch (error) {
            console.error("Error saving routine:", error);
            alert('Errore durante il salvataggio. Riprova.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salva';
        }
    });
});
