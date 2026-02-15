const AddExerciseModal = {
    allExercises: [],
    filteredExercises: [],
    selectedMuscles: new Set(),
    selectedTypes: new Set(),
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
            this.renderExercises();
        } catch (error) {
            console.error('Error loading exercises:', error);
            const grid = document.getElementById('exercises-grid');
            if(grid) grid.innerHTML = '<p style="color:red; text-align:center;">Errore nel caricamento degli esercizi.</p>';
        }
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
                this.filterExercises(e.target.value);
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

        const muscleCheckboxes = document.querySelectorAll('#muscle-filters input[type="checkbox"]');
        muscleCheckboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedMuscles.add(e.target.value);
                } else {
                    this.selectedMuscles.delete(e.target.value);
                }
                this.filterExercises(searchInput ? searchInput.value : '');
            });
        });

        const typeCheckboxes = document.querySelectorAll('#type-filters input[type="checkbox"]');
        typeCheckboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedTypes.add(e.target.value);
                } else {
                    this.selectedTypes.delete(e.target.value);
                }
                this.filterExercises(searchInput ? searchInput.value : '');
            });
        });
    },

    filterExercises: function(searchTerm) {
        searchTerm = searchTerm.toLowerCase();

        this.filteredExercises = this.allExercises.filter(ex => {
            const matchesSearch = (ex.name_it && ex.name_it.toLowerCase().includes(searchTerm)) || 
                                  (ex.name && ex.name.toLowerCase().includes(searchTerm));

            if (!matchesSearch) return false;

            let matchesMuscle = true;
            if (this.selectedMuscles.size > 0) {
                 matchesMuscle = Array.from(this.selectedMuscles).some(muscle => {
                    const bodyParts = (ex.bodyParts_it || []).map(bp => bp.toLowerCase());
                    
                    if (muscle === 'Spalle') return bodyParts.includes('spalle');
                    if (muscle === 'Petto') return bodyParts.includes('petto');
                    if (muscle === 'Schiena') return bodyParts.includes('dorso') || bodyParts.includes('back');
                    if (muscle === 'Braccia') return bodyParts.some(bp => bp.includes('braccia') || bp.includes('arms'));
                    if (muscle === 'Addominali') return bodyParts.includes('addominali') || bodyParts.includes('waist');
                    if (muscle === 'Gambe') return bodyParts.some(bp => bp.includes('gambe') || bp.includes('legs') || bp.includes('calves'));
                    return false;
                 });
            }

            let matchesType = true;
            if (this.selectedTypes.size > 0) {
                const isCardio = (ex.bodyParts_it || []).includes('cardio') || (ex.bodyParts || []).includes('cardio');
                
                const showCardio = this.selectedTypes.has('Cardio');
                const showMassa = this.selectedTypes.has('Massa');

                if (showCardio && showMassa) {
                    matchesType = true;
                } else if (showCardio) {
                    matchesType = isCardio;
                } else if (showMassa) {
                    matchesType = !isCardio;
                }
            }

            return matchesMuscle && matchesType;
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


