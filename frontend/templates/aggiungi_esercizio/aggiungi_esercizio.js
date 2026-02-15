const AddExerciseModal = {
    allExercises: [],
    filteredExercises: [],
    selectedBodyParts: new Set(),
    selectedEquipments: new Set(),
    selectedTargetMuscles: new Set(),
    targetSedutaId: null,

    init: async function() {
        console.log('Initializing Add Exercise Modal...');
        await this.loadExercises();
        this.setupListeners();
    },

    loadExercises: async function() {
        try {
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            this.allExercises = await response.json();
            this.filteredExercises = this.allExercises;
            console.log(`Loaded ${this.allExercises.length} exercises.`);
            this.generateFilters();
            this.renderExercises();
        } catch (error) {
            console.error('Error loading exercises:', error);
            const grid = document.getElementById('exercises-grid');
            if(grid) grid.innerHTML = '<p style="color:red; text-align:center;">Errore nel caricamento degli esercizi.</p>';
        }
    },

    generateFilters: function() {
        const filtersContainer = document.getElementById('dynamic-filters');
        if (!filtersContainer) return;

        // Extract unique values
        const bodyParts = new Set();
        const equipments = new Set();
        const targetMuscles = new Set();

        this.allExercises.forEach(ex => {
            if (ex.bodyParts_it) ex.bodyParts_it.forEach(bp => bodyParts.add(bp));
            if (ex.equipments_it) ex.equipments_it.forEach(eq => equipments.add(eq));
            if (ex.targetMuscles_it) ex.targetMuscles_it.forEach(tm => targetMuscles.add(tm));
        });

        // Helper to create filter group
        const createFilterGroup = (title, items, type) => {
            const group = document.createElement('div');
            group.className = 'filter-group';
            
            // Header container
            const header = document.createElement('div');
            header.className = 'filter-header';
            
            const h3 = document.createElement('h3');
            h3.textContent = title;
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-chevron-down filter-toggle-icon';
            
            header.appendChild(h3);
            header.appendChild(icon);
            group.appendChild(header);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'filter-options';

            // Sort items alphabetically
            const sortedItems = Array.from(items).sort((a, b) => a.localeCompare(b));

            sortedItems.forEach(item => {
                const label = document.createElement('label');
                label.className = 'toggle-switch';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = item;
                input.dataset.type = type; // 'bodyPart', 'equipment', 'targetMuscle'

                const slider = document.createElement('span');
                slider.className = 'slider round';

                const text = document.createElement('span');
                text.className = 'label-text';
                text.textContent = item;

                label.appendChild(input);
                label.appendChild(slider);
                label.appendChild(text);
                optionsDiv.appendChild(label);
            });

            group.appendChild(optionsDiv);
            
            // Toggle functionality
            header.addEventListener('click', () => {
                group.classList.toggle('collapsed');
            });
            
            return group;
        };

        filtersContainer.innerHTML = '';
        filtersContainer.appendChild(createFilterGroup('Parti del Corpo', bodyParts, 'bodyPart'));
        filtersContainer.appendChild(createFilterGroup('Attrezzatura', equipments, 'equipment'));
        filtersContainer.appendChild(createFilterGroup('Muscoli', targetMuscles, 'targetMuscle'));

        // Add event listeners to new checkboxes
        const checkboxes = filtersContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const type = e.target.dataset.type;
                const value = e.target.value;
                const checked = e.target.checked;

                if (type === 'bodyPart') {
                    if (checked) this.selectedBodyParts.add(value);
                    else this.selectedBodyParts.delete(value);
                } else if (type === 'equipment') {
                    if (checked) this.selectedEquipments.add(value);
                    else this.selectedEquipments.delete(value);
                } else if (type === 'targetMuscle') {
                    if (checked) this.selectedTargetMuscles.add(value);
                    else this.selectedTargetMuscles.delete(value);
                }

                this.filterExercises();
            });
        });
    },

    renderExercises: function() {
        const grid = document.getElementById('exercises-grid');
        const noResults = document.getElementById('no-exercises-found');
        
        if (!grid) return;

        grid.innerHTML = '';

        if (this.filteredExercises.length === 0) {
            if(noResults) noResults.style.display = 'block';
            return;
        }
        if(noResults) noResults.style.display = 'none';

        // Limit to 50 for performance
        const exercisesToShow = this.filteredExercises.slice(0, 50);

        exercisesToShow.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'exercise-card';
            card.innerHTML = `
                <div class="card-image">
                    <img src="${ex.gifUrl}" alt="${ex.name}" loading="lazy">
                </div>
                <div class="card-info">
                    <h4>${ex.name_it || ex.name}</h4>
                </div>
            `;
            
            card.addEventListener('click', () => {
                this.addExerciseToSeduta(ex);
            });
            
            grid.appendChild(card);
        });
    },

    addExerciseToSeduta: function(exercise) {
        if (this.targetSedutaId) {
            const event = new CustomEvent('exercise-selected', { 
                detail: { 
                    exercise: exercise, 
                    sedutaId: this.targetSedutaId 
                } 
            });
            document.dispatchEvent(event);
            this.close();
        } else {
            console.error('No target seduta ID set');
        }
    },

    setupListeners: function() {
        const searchInput = document.getElementById('exercise-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterExercises();
            });
        }

        const closeBtn = document.getElementById('close-exercise-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }

        // Close on click outside
        const modal = document.getElementById('add-exercise-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }
    },

    filterExercises: function() {
        const searchInput = document.getElementById('exercise-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        this.filteredExercises = this.allExercises.filter(ex => {
            // Search Text
            const matchesSearch = (ex.name_it && ex.name_it.toLowerCase().includes(searchTerm)) || 
                                  (ex.name && ex.name.toLowerCase().includes(searchTerm));

            if (!matchesSearch) return false;

            // Filter by Body Part
            let matchesBodyPart = true;
            if (this.selectedBodyParts.size > 0) {
                const exBodyParts = (ex.bodyParts_it || []);
                matchesBodyPart = exBodyParts.some(bp => this.selectedBodyParts.has(bp));
            }

            // Filter by Equipment
            let matchesEquipment = true;
            if (this.selectedEquipments.size > 0) {
                const exEquipments = (ex.equipments_it || []);
                matchesEquipment = exEquipments.some(eq => this.selectedEquipments.has(eq));
            }

            // Filter by Target Muscle
            let matchesTargetMuscle = true;
            if (this.selectedTargetMuscles.size > 0) {
                const exTargetMuscles = (ex.targetMuscles_it || []);
                matchesTargetMuscle = exTargetMuscles.some(tm => this.selectedTargetMuscles.has(tm));
            }

            return matchesBodyPart && matchesEquipment && matchesTargetMuscle;
        });

        this.renderExercises();
    },

    open: function(sedutaId) {
        this.targetSedutaId = sedutaId;
        const modal = document.getElementById('add-exercise-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Force redraw/rendering if needed
            this.renderExercises(); 
        }
    },

    close: function() {
        this.targetSedutaId = null;
        const modal = document.getElementById('add-exercise-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
};

window.AddExerciseModal = AddExerciseModal;
