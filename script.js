// Log iniziale per verificare che il script venga caricato correttamente
console.log('=== FitSuite Script Inizializzato ===');

// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

// Verifica che gli elementi DOM esistano
if (hamburger) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks?.classList.toggle('active');
    });
}

if (navLinks) {
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
}

// DOM Elements
const grid = document.getElementById('exercise-grid');
const searchInput = document.getElementById('search-input');
const pagination = document.getElementById('pagination');
const loading = document.getElementById('loading');

// State
let allExercises = [];
let originalExercises = [];
let currentPage = 1;
const itemsPerPage = 9; // 3x3 grid per pagina
let totalResults = 0;

// Function to display exercises
function displayExercises() {
    // Controlla che l'elemento grid esista
    if (!grid) {
        console.error('Errore: Elemento grid non trovato');
        return;
    }
    
    grid.innerHTML = '';
    
    // Rimuovi il messaggio dei risultati precedente se esiste
    const existingResultsInfo = grid.parentNode?.querySelector('.results-info');
    if (existingResultsInfo) {
        existingResultsInfo.remove();
    }
    
    // Calcola l'indice di inizio e fine
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToShow = allExercises.slice(start, end);

    if (itemsToShow.length === 0 && currentPage === 1) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun esercizio trovato per questa ricerca.</p>`;
        return;
    }
    
    // Aggiungi un messaggio con il numero totale di risultati
    if (grid.parentNode) {
        const resultsInfo = document.createElement('div');
        resultsInfo.className = 'results-info';
        resultsInfo.style.cssText = 'color: #888; margin-bottom: 20px; font-size: 14px; text-align: center;';
        resultsInfo.textContent = `Trovati ${totalResults} esercizi`;
        grid.parentNode.insertBefore(resultsInfo, grid);
    }
    
    // Se non abbiamo risultati per questa pagina, mostriamo un messaggio
    if (itemsToShow.length === 0 && currentPage === 1) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun esercizio trovato per questa ricerca.</p>`;
    } else if (itemsToShow.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun altro esercizio trovato.</p>`;
    } else {
        // Se abbiamo risultati da mostrare, li renderizziamo
        itemsToShow.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'exercise-item';
            
            card.innerHTML = `
                <div class="exercise-image">
                    <img src="${ex.gifUrl}" alt="${ex.name}">
                </div>
                <div class="exercise-info">
                    <h4>${ex.name_it}</h4>
                </div>
            `;
            grid.appendChild(card);
        });
    }


}

// Function to setup pagination
function setupPagination() {
    console.log('setupPagination() called.');
    // Controlla che l'elemento pagination esista
    if (!pagination) {
        console.error('Errore: Elemento pagination non trovato');
        return;
    }
    
    pagination.innerHTML = ''; // Pulisci sempre la paginazione all'inizio

    const totalPages = Math.ceil(allExercises.length / itemsPerPage);
    console.log(`allExercises.length: ${allExercises.length}, totalPages: ${totalPages}`);

    if (totalPages <= 1) { // Se non ci sono pagine o solo una, nascondi la paginazione
        pagination.classList.add('hidden');
        console.log('Pagination hidden. Current pagination classList:', pagination.classList.value);
        return;
    }
    pagination.classList.remove('hidden'); // Mostra la paginazione se ci sono più pagine
    console.log('Pagination shown. Current pagination classList:', pagination.classList.value);

    // Container per i pulsanti di paginazione
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';

    // Pulsante Precedente
    const prevButton = document.createElement('button');
    prevButton.innerText = 'Precedente';
    prevButton.className = `page-btn prev-btn`;
    prevButton.disabled = currentPage === 1;
    
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayExercises();
            setupPagination();
        }
    };
    
    paginationContainer.appendChild(prevButton);

    // Logica per i numeri di pagina con puntini di sospensione
    const pageNumbersToShow = new Set();

    // Aggiungi sempre la prima pagina
    if (totalPages > 0) {
        pageNumbersToShow.add(1);
    }

    // Aggiungi le pagine intorno alla pagina corrente
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        if (i > 1 && i < totalPages) { // Assicurati che non sia la prima o l'ultima pagina
            pageNumbersToShow.add(i);
        }
    }

    // Aggiungi sempre l'ultima pagina (se diversa dalla prima)
    if (totalPages > 1) {
        pageNumbersToShow.add(totalPages);
    }

    // Converti in array e ordina
    const sortedPageNumbers = Array.from(pageNumbersToShow).sort((a, b) => a - b);

    // Costruisci la lista finale con i puntini di sospensione
    const finalPages = [];
    let lastPageAdded = 0;

    sortedPageNumbers.forEach(page => {
        if (page - lastPageAdded > 1) {
            finalPages.push('...');
        }
        finalPages.push(page);
        lastPageAdded = page;
    });

    // Crea i pulsanti per i numeri di pagina e i puntini di sospensione
    finalPages.forEach(pageNumber => {
        if (pageNumber === '...') {
            const span = document.createElement('span');
            span.innerText = '...';
            span.className = 'page-ellipsis';
            paginationContainer.appendChild(span);
        } else {
            const button = document.createElement('button');
            button.innerText = pageNumber;
            button.className = `page-btn ${pageNumber === currentPage ? 'active' : ''}`;
            
            button.onclick = () => {
                currentPage = pageNumber;
                displayExercises();
                setupPagination();
            };
            
            paginationContainer.appendChild(button);
        }
    });

    // Pulsante Successivo
    const nextButton = document.createElement('button');
    nextButton.innerText = 'Successivo';
    nextButton.className = `page-btn next-btn`;
    nextButton.disabled = currentPage === totalPages;
    
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayExercises();
            setupPagination();
        }
    };
    
    paginationContainer.appendChild(nextButton);
    pagination.appendChild(paginationContainer);
}

// Function to perform search
function performSearch() {
    const query = searchInput?.value.trim().toLowerCase() || '';
    let filteredExercises = originalExercises;
    
    if (query) {
        filteredExercises = originalExercises.filter(ex => 
            ex.name_it.toLowerCase().includes(query) || ex.name.toLowerCase().includes(query)
        );
    }
    totalResults = filteredExercises.length;
    currentPage = 1;
    allExercises = filteredExercises; // Assegna i risultati filtrati
    
    // Se non ci sono risultati, assicurati che allExercises sia vuoto per nascondere la paginazione
    if (filteredExercises.length === 0) {
        allExercises = [];
    }
    
    displayExercises();
    setupPagination();
}

// Initialize the application
async function init() {
    try {
        if (loading) {
            loading.style.display = 'block';
        }
        
        // Carica i dati direttamente da exercises.json
        const response = await fetch('./backend/data_it/esercizi_DATABASE_TOTALE.json');
        const exercises = await response.json();
        
        originalExercises = exercises;
        allExercises = originalExercises;
        totalResults = allExercises.length;
        
        displayExercises();
        setupPagination();

        // Aggiungi event listener per la ricerca
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                // Debounce per evitare ricerche troppo frequenti
                clearTimeout(window.searchTimeout);
                window.searchTimeout = setTimeout(() => {
                    performSearch();
                }, 300);
            });
        }
    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        if (grid) {
            grid.innerHTML = `<p style="color:red; grid-column: 1/-1;">Si è verificato un errore nel caricamento. Riprova.</p>`;
        }
    } finally {
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// Avvia l'applicazione quando la pagina è pronta
window.addEventListener('DOMContentLoaded', init);