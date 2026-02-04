// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

// Toggle mobile menu
function toggleMenu() {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
}

// Close menu when clicking on a link
function closeMenu() {
    hamburger.classList.remove('active');
    navLinks.classList.remove('active');
}

// Event listeners for mobile menu
hamburger.addEventListener('click', toggleMenu);
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
});

// Configurazione API MuscleWiki
const API_KEY = 'a822549d34msh7566f05f1d609b6p161dc7jsnedc004a34f7b'; 
const API_HOST = 'musclewiki-api.p.rapidapi.com';

const grid = document.getElementById('exercise-grid');
const searchInput = document.getElementById('search-input');
const pagination = document.getElementById('pagination');
const loading = document.getElementById('loading');

let allExercises = [];
let currentPage = 1;
const itemsPerPage = 9; // 3x3 grid per pagina
let totalResults = 0;
let isLoading = false;

// Dizionario per supportare la ricerca in Italiano
const dizionario = {
    "panca": "bench",
    "petto": "chest",
    "spalle": "shoulders",
    "bicipiti": "biceps",
    "tricipiti": "triceps",
    "schiena": "back",
    "gambe": "quads",
    "addominali": "abs",
    "stacco": "deadlift",
    "squat": "squat",
    "affondi": "lunges",
    "trazioni": "pull up",
    "flessioni": "push up"
};

async function executeSearch(query) {
    let term = query.toLowerCase().trim();
    
    // Traduci se il termine è nel dizionario
    if (dizionario[term]) {
        term = dizionario[term];
    }

    if (term.length < 2) return;

    // Reset interfaccia
    loading.style.display = 'block';
    grid.innerHTML = '';
    pagination.innerHTML = '';
    allExercises = [];
    currentPage = 1;
    totalResults = 0;

    try {
        // Prima chiamata per testare il formato della risposta
        const response = await fetch(`https://${API_HOST}/search?q=${encodeURIComponent(term)}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': API_KEY,
                'X-RapidAPI-Host': API_HOST
            }
        });

        if (!response.ok) throw new Error("Errore durante la chiamata API");

        const data = await response.json();
        console.log("Dati API completi:", data);
        
        // Analizza il formato della risposta
        let allResults = [];
        
        if (data.results && Array.isArray(data.results)) {
            // Caso 1: Risposta con struttura { results: [...], total: N }
            allResults = data.results;
            totalResults = data.total || data.results.length;
            console.log("Formato API con results array");
        }
        else if (Array.isArray(data)) {
            // Caso 2: Risposta diretta con array di esercizi
            allResults = data;
            totalResults = data.length;
            console.log("Formato API con array diretto");
        }
        else if (data.exercises && Array.isArray(data.exercises)) {
            // Caso 3: Risposta con struttura { exercises: [...], total: N }
            allResults = data.exercises;
            totalResults = data.total || data.exercises.length;
            console.log("Formato API con exercises array");
        }
        else {
            // Caso inaspettato - logga la struttura
            console.error("Formato API inaspettato:", data);
            throw new Error("Formato di risposta API non supportato");
        }
        
        console.log("Totale risultati API:", totalResults);
        console.log("Totale risultati caricati:", allResults.length);
        
        // Se riceviamo esattamente 10 risultati, è probabile che l'API limiti i risultati
        // Prova a fare una chiamata con parametri di paginazione diversi per verificare
        if (allResults.length === 10) {
            console.log("Attenzione: API restituita esattamente 10 risultati. Provo con parametri di paginazione...");
            
            // Prova con parametri di paginazione standard per API REST
            try {
                const page2Response = await fetch(`https://${API_HOST}/search?q=${encodeURIComponent(term)}&offset=10`, {
                    method: 'GET',
                    headers: {
                        'X-RapidAPI-Key': API_KEY,
                        'X-RapidAPI-Host': API_HOST
                    }
                });
                
                if (page2Response.ok) {
                    const page2Data = await page2Response.json();
                    console.log("Risultati pagina 2:", page2Data);
                    
                    // Verifica se ci sono risultati aggiuntivi
                    let page2Results = [];
                    if (page2Data.results && Array.isArray(page2Data.results)) {
                        page2Results = page2Data.results;
                    } else if (Array.isArray(page2Data)) {
                        page2Results = page2Data;
                    } else if (page2Data.exercises && Array.isArray(page2Data.exercises)) {
                        page2Results = page2Data.exercises;
                    }
                    
                    if (page2Results.length > 0) {
                        // Aggiungi i risultati della seconda pagina
                        allResults.push(...page2Results);
                        console.log("Aggiunti", page2Results.length, "risultati dalla pagina 2");
                        console.log("Totale risultati aggiornato:", allResults.length);
                        
                        // Aggiorna il totale
                        totalResults = allResults.length;
                    } else {
                        console.log("Nessun risultato aggiuntivo nella pagina 2");
                    }
                }
            } catch (page2Error) {
                console.log("Errore nella chiamata per la pagina 2:", page2Error);
            }
        }
        
        // Filtriamo eventuali oggetti non validi
        allExercises = allResults.filter(ex => ex && ex.name);
        console.log("Esercizi validi:", allExercises.length);
        
        // Aggiorniamo il totale se necessario
        if (totalResults === 0 || totalResults < allExercises.length) {
            totalResults = allExercises.length;
        }
        
        console.log("Totale risultati da mostrare:", totalResults);
        
        displayPage(1);
    } catch (err) {
        console.error("Errore:", err);
        grid.innerHTML = `<p style="color:red; grid-column: 1/-1;">Si è verificato un errore nel caricamento. Riprova.</p>`;
    } finally {
        loading.style.display = 'none';
    }
}

function displayPage(page) {
    console.log("displayPage chiamato con pagina:", page);
    console.log("allExercises.length:", allExercises.length);
    
    // Rimuovi il messaggio dei risultati precedente se esiste
    const existingResultsInfo = grid.parentNode.querySelector('.results-info');
    if (existingResultsInfo) {
        existingResultsInfo.remove();
    }
    
    grid.innerHTML = '';
    
    // Calcola l'indice di inizio e fine
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    console.log(`Indici: start=${start}, end=${end}`);
    
    const itemsToShow = allExercises.slice(start, end);
    console.log(`Items da mostrare: ${itemsToShow.length}`);

    if (itemsToShow.length === 0 && page === 1) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun esercizio trovato per questa ricerca.</p>`;
        return;
    }
    
    // Aggiungi un messaggio con il numero totale di risultati
    const resultsInfo = document.createElement('div');
    resultsInfo.className = 'results-info';
    resultsInfo.style.cssText = 'color: #888; margin-bottom: 20px; font-size: 14px; text-align: center;';
    resultsInfo.textContent = `Trovati ${totalResults} esercizi`;
    grid.parentNode.insertBefore(resultsInfo, grid);
    
    // Se abbiamo risultati da mostrare, li renderizziamo
    if (itemsToShow.length > 0) {
        itemsToShow.forEach(ex => {
            const cardId = `img-${ex.id}`;
            const card = document.createElement('div');
            card.className = 'exercise-item';
            
            card.innerHTML = `
                <div class="exercise-image">
                    <img id="${cardId}" src="https://placehold.co/400x300?text=Caricamento..." alt="${ex.name}">
                </div>
                <div class="exercise-info">
                    <h4>${ex.name}</h4>
                </div>
            `;
            grid.appendChild(card);

            // Caricamento sicuro dell'immagine tramite Blob
            if (ex.videos && ex.videos.length > 0 && ex.videos[0].og_image) {
                fetchAndSetImage(ex.videos[0].og_image, cardId);
            }
        });
    } else {
        // Se non abbiamo risultati per questa pagina, mostriamo un messaggio
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun altro esercizio trovato.</p>`;
    }

    setupPagination();
}

function setupPagination() {
    console.log("setupPagination chiamato");
    console.log("allExercises.length:", allExercises.length);
    console.log("itemsPerPage:", itemsPerPage);
    
    pagination.innerHTML = '';
    const totalPages = Math.ceil(allExercises.length / itemsPerPage);
    console.log("Pagine totali calcolate:", totalPages);

    if (totalPages <= 1) {
        console.log("Solo una pagina, non mostro paginazione");
        return;
    }

    console.log("Creo bottoni paginazione per", totalPages, "pagine");
    
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.innerText = i;
        button.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        
        button.onclick = () => {
            console.log("Cliccato bottone pagina", i);
            currentPage = i;
            displayPage(i);
            // Scroll fluido verso l'inizio della griglia
            document.querySelector('.exercise-showcase').scrollIntoView({ behavior: 'smooth' });
        };
        
        pagination.appendChild(button);
    }
}

async function fetchAndSetImage(url, imgId) {
    try {
        const response = await fetch(url, {
            headers: {
                'X-RapidAPI-Key': API_KEY,
                'X-RapidAPI-Host': API_HOST
            }
        });
        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        const img = document.getElementById(imgId);
        if (img) img.src = objectURL;
    } catch (e) {
        console.error("Errore immagine:", e);
    }
}

// Event Listener per la ricerca con Invio
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        executeSearch(searchInput.value);
    }
});

// Auto search for "bench" on page load
executeSearch('bench');