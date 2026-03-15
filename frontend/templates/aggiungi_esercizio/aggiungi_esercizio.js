const AddExerciseModal = {
    allExercises: [],
    filteredExercises: [],
    selectedBodyParts: new Set(),
    selectedEquipments: new Set(),
    selectedTargetMuscles: new Set(),
    targetSedutaId: null,
    currentCategory: 'bodyParts',
    filterData: {
        bodyParts: new Set(),
        equipments: new Set(),
        muscles: new Set()
    },

    init: async function() {
        console.log('Initializing Add Exercise Modal...');
        await this.loadExercises();
        this.setupListeners();
        this.setupCategoryButtons();
        this.updateFilterBadges();
        this.showCategory('bodyParts'); // Show body parts by default
    },

    loadExercises: async function() {
        try {
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            this.allExercises = await response.json();
            this.filteredExercises = this.allExercises;
            console.log(`Loaded ${this.allExercises.length} exercises.`);
            this.extractFilterData();
            this.generateFilters();
            this.renderExercises();
        } catch (error) {
            console.error('Error loading exercises:', error);
            const grid = document.getElementById('exercises-grid');
            if(grid) grid.innerHTML = '<p style="color:red; text-align:center;">Errore nel caricamento degli esercizi.</p>';
        }
    },

    extractFilterData: function() {
        // Extract unique values and store them
        this.allExercises.forEach(ex => {
            if (ex.bodyParts_it) ex.bodyParts_it.forEach(bp => this.filterData.bodyParts.add(bp));
            if (ex.equipments_it) ex.equipments_it.forEach(eq => this.filterData.equipments.add(eq));
            if (ex.targetMuscles_it) ex.targetMuscles_it.forEach(tm => this.filterData.muscles.add(tm));
        });
    },

    setupCategoryButtons: function() {
        const categoryButtons = document.querySelectorAll('.category-btn[data-category]');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this.showCategory(category);
                
                // Update active state
                categoryButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    },

    showCategory: function(category) {
        this.currentCategory = category;
        
        // Generate filters for the selected category
        this.generateFilters();
    },

    generateFilters: function() {
        const filtersContainer = document.getElementById('dynamic-filters');
        if (!filtersContainer) return;

        filtersContainer.innerHTML = '';

        // Helper to create filter group
        const createFilterGroup = (title, items, type) => {
            const group = document.createElement('div');
            group.className = 'filter-group';
            
            // Header container
            const header = document.createElement('div');
            header.className = 'filter-header';
            header.style.cursor = 'default'; // No longer clickable
            
            const h3 = document.createElement('h3');
            h3.textContent = title;
            
            header.appendChild(h3);
            group.appendChild(header);

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'filter-options';

            // Sort items alphabetically
            const sortedItems = Array.from(items).sort((a, b) => a.localeCompare(b, 'it'));

            sortedItems.forEach(item => {
                const label = document.createElement('label');
                label.className = 'toggle-switch';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = item;
                input.dataset.type = type;

                // Check if this filter was previously selected
                const isSelected = this.isFilterSelected(type, item);
                input.checked = isSelected;

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
            
            return group;
        };

        // Generate filters based on current category
        if (this.currentCategory === 'bodyParts' && this.filterData.bodyParts.size > 0) {
            filtersContainer.appendChild(createFilterGroup('Parti del corpo', this.filterData.bodyParts, 'bodyPart'));
        } else if (this.currentCategory === 'equipments' && this.filterData.equipments.size > 0) {
            filtersContainer.appendChild(createFilterGroup('Attrezzatura', this.filterData.equipments, 'equipment'));
        } else if (this.currentCategory === 'muscles' && this.filterData.muscles.size > 0) {
            filtersContainer.appendChild(createFilterGroup('Muscoli', this.filterData.muscles, 'targetMuscle'));
        }

        // Add event listeners to new checkboxes
        const checkboxes = filtersContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                this.handleFilterChange(e);
            });
        });
    },

    isFilterSelected: function(type, value) {
        if (type === 'bodyPart') {
            return this.selectedBodyParts.has(value);
        } else if (type === 'equipment') {
            return this.selectedEquipments.has(value);
        } else if (type === 'targetMuscle') {
            return this.selectedTargetMuscles.has(value);
        }
        return false;
    },

    handleFilterChange: function(e) {
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

        this.updateFilterBadges();
        this.filterExercises();
    },

    updateFilterBadges: function() {
        const badges = {
            bodyParts: this.selectedBodyParts.size,
            equipments: this.selectedEquipments.size,
            muscles: this.selectedTargetMuscles.size
        };

        Object.keys(badges).forEach(category => {
            const badge = document.querySelector(`.filter-badge[data-count="${category}"]`);
            if (badge) {
                const count = badges[category];
                badge.textContent = count;
                if (count > 0) {
                    badge.classList.add('active');
                } else {
                    badge.classList.remove('active');
                }
            }
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

    resetFilters: function() {
        // Clear all selected filters
        this.selectedBodyParts.clear();
        this.selectedEquipments.clear();
        this.selectedTargetMuscles.clear();
        
        this.updateFilterBadges();
        
        // Uncheck all checkboxes
        const filtersContainer = document.getElementById('dynamic-filters');
        if (filtersContainer) {
            const checkboxes = filtersContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = false;
            });
        }
        
        // Clear search input
        const searchInput = document.getElementById('exercise-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset filtered exercises and re-render
        this.filteredExercises = this.allExercises;
        this.renderExercises();
    },

    setupListeners: function() {
        const searchInput = document.getElementById('exercise-search');
        if (searchInput) {
            // Debounce search to improve performance on mobile
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterExercises();
                }, 400); // 400ms delay for search
            });
        }

        const closeBtn = document.getElementById('close-exercise-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }

        const resetBtn = document.getElementById('reset-filters-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFilters();
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

        // Handle back button to close modal
        window.addEventListener('popstate', (event) => {
            if (modal && modal.style.display === 'flex') {
                this.close(true);
            }
        });
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
            // Push dummy state to history for back button handling
            if (!history.state || !history.state.popupOpen) {
                history.pushState({ popupOpen: true }, '');
            }
            
            modal.style.display = 'flex';
            // Force redraw/rendering if needed
            this.renderExercises(); 
        }
    },

    close: function(fromBackAction = false) {
        this.targetSedutaId = null;
        const modal = document.getElementById('add-exercise-modal');
        if (modal) {
            modal.style.display = 'none';
            
            // If closed manually (not via back button), remove the state from history
            if (!fromBackAction && history.state && history.state.popupOpen) {
                history.back();
            }
        }
    }
};

window.AddExerciseModal = AddExerciseModal;
