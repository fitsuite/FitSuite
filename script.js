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
    
    // Se abbiamo risultati da mostrare, li renderizziamo
    if (itemsToShow.length > 0) {
        itemsToShow.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'exercise-item';
            
            card.innerHTML = `
                <div class="exercise-image">
                    <img src="${ex.gifUrl}" alt="${ex.name}">
                </div>
                <div class="exercise-info">
                    <h4>${ex.name}</h4>
                </div>
            `;
            grid.appendChild(card);
        });
    } else {
        // Se non abbiamo risultati per questa pagina, mostriamo un messaggio
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun altro esercizio trovato.</p>`;
    }

    setupPagination();
}

// Function to setup pagination
function setupPagination() {
    // Controlla che l'elemento pagination esista
    if (!pagination) {
        console.error('Errore: Elemento pagination non trovato');
        return;
    }
    
    pagination.innerHTML = '';
    const totalPages = Math.ceil(allExercises.length / itemsPerPage);

    if (totalPages <= 1) return;

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
        }
    };
    
    paginationContainer.appendChild(prevButton);

    // Numero di pagine da mostrare (evita troppi pulsanti)
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Ajusta se siamo vicino alla fine
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Pulsanti delle pagine
    for (let i = startPage; i <= endPage; i++) {
        const button = document.createElement('button');
        button.innerText = i;
        button.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        
        button.onclick = () => {
            currentPage = i;
            displayExercises();
        };
        
        paginationContainer.appendChild(button);
    }

    // Pulsante Successivo
    const nextButton = document.createElement('button');
    nextButton.innerText = 'Successivo';
    nextButton.className = `page-btn next-btn`;
    nextButton.disabled = currentPage === totalPages;
    
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayExercises();
        }
    };
    
    paginationContainer.appendChild(nextButton);
    pagination.appendChild(paginationContainer);
}

// Function to perform search
function performSearch() {
    const query = searchInput?.value.trim().toLowerCase() || '';
    let filteredExercises = allExercises;
    
    if (query) {
        filteredExercises = allExercises.filter(ex => 
            ex.name.toLowerCase().includes(query)
        );
    }
    
    totalResults = filteredExercises.length;
    currentPage = 1;
    allExercises = filteredExercises;
    displayExercises();
}

// Initialize the application
async function init() {
    try {
        if (loading) {
            loading.style.display = 'block';
        }
        
        // Carica i dati direttamente da exercises.json
        const response = await fetch('./backend/data/exercises.json');
        const exercises = await response.json();
        
        allExercises = exercises;
        totalResults = allExercises.length;
        
        displayExercises();
        
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
