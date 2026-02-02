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

    try {
        const response = await fetch(`https://${API_HOST}/search?q=${encodeURIComponent(term)}`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': API_KEY,
                'X-RapidAPI-Host': API_HOST
            }
        });

        if (!response.ok) throw new Error("Errore durante la chiamata API");

        allExercises = await response.json();
        displayPage(1);
    } catch (err) {
        console.error("Errore:", err);
        grid.innerHTML = `<p style="color:red; grid-column: 1/-1;">Si è verificato un errore nel caricamento. Riprova.</p>`;
    } finally {
        loading.style.display = 'none';
    }
}

function displayPage(page) {
    grid.innerHTML = '';
    
    // Calcola l'indice di inizio e fine
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToShow = allExercises.slice(start, end);

    if (itemsToShow.length === 0 && page === 1) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #888; padding: 40px;">Nessun esercizio trovato per questa ricerca.</p>`;
        return;
    }

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

    setupPagination();
}

function setupPagination() {
    pagination.innerHTML = '';
    const totalPages = Math.ceil(allExercises.length / itemsPerPage);

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.innerText = i;
        button.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        
        button.onclick = () => {
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