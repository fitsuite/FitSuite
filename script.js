// Log iniziale per verificare che il script venga caricato correttamente
console.log('=== FitSuite Script Inizializzato ===');

// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

// Verifica che gli elementi DOM esistano
if (hamburger) {
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita che il click si propaghi al document
        hamburger.classList.toggle('active');
        navLinks?.classList.toggle('active');
    });
}

// Chiudi la navbar quando si clicca fuori
document.addEventListener('click', (e) => {
    if (navLinks && navLinks.classList.contains('active')) {
        const isClickInsideNav = navLinks.contains(e.target);
        const isClickOnHamburger = hamburger.contains(e.target);
        
        if (!isClickInsideNav && !isClickOnHamburger) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        }
    }
});

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

// Popup Stepper State
let currentInstructions = [];
let currentStepIndex = 0;

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

            // Aggiungi event listener per il popup
            card.addEventListener('click', () => {
                showExercisePopup(ex);
            });

            grid.appendChild(card);
        });
    }

    setupPagination(); // Aggiunto per aggiornare la paginazione dopo aver visualizzato gli esercizi
}

// Funzione per mostrare il popup dell'esercizio
function showExercisePopup(ex) {
    console.log('Mostrando popup per:', ex.name_it);
    const popup = document.getElementById('exercise-detail-popup');
    const popupImg = document.getElementById('popup-exercise-gif');
    const popupName = document.getElementById('popup-exercise-name');
    const popupDesc = document.getElementById('popup-exercise-description');
    const stepCounter = document.getElementById('popup-step-counter');

    if (!popup || !popupImg || !popupName || !popupDesc) {
        console.error('Errore: Elementi del popup non trovati');
        return;
    }

    popupName.textContent = ex.name_it || ex.name;
    popupImg.src = ex.gifUrl;
    
    // Gestione Istruzioni con Stepper - Usando instructions_it e pulendo il testo
    const rawInstructions = ex.instructions_it || ex.instructions || [];
    currentInstructions = rawInstructions.map(instr => {
        // Taglia esattamente i primi 6 caratteri (es. "Step:1") e pulisce gli spazi
        return instr.substring(6).trim();
    });
    
    currentStepIndex = 0;
    
    updateStepDisplay();

    popup.classList.add('active');
    document.body.style.overflow = 'hidden'; // Impedisci lo scroll della pagina
}

// Funzione per aggiornare la visualizzazione dello step
function updateStepDisplay() {
    const popupDesc = document.getElementById('popup-exercise-description');
    const stepCounter = document.getElementById('popup-step-counter');
    const prevBtn = document.getElementById('prev-step');
    const nextBtn = document.getElementById('next-step');

    if (!popupDesc || !stepCounter || !prevBtn || !nextBtn) return;

    if (currentInstructions.length > 0) {
        popupDesc.textContent = currentInstructions[currentStepIndex];
        stepCounter.textContent = `${currentStepIndex + 1} / ${currentInstructions.length}`;
        
        // Abilita/Disabilita bottoni
        prevBtn.disabled = currentStepIndex === 0;
        nextBtn.disabled = currentStepIndex === currentInstructions.length - 1;
        
        // Nascondi bottoni se c'è solo uno step
        if (currentInstructions.length <= 1) {
            prevBtn.style.visibility = 'hidden';
            nextBtn.style.visibility = 'hidden';
        } else {
            prevBtn.style.visibility = 'visible';
            nextBtn.style.visibility = 'visible';
        }
    } else {
        popupDesc.textContent = "Istruzioni non disponibili per questo esercizio.";
        stepCounter.textContent = "0 / 0";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }
}

// Funzione per chiudere il popup
function closeExercisePopup() {
    const popup = document.getElementById('exercise-detail-popup');
    if (popup) {
        popup.classList.remove('active');
        document.body.style.overflow = ''; // Ripristina lo scroll
    }
}

// Inizializza i listener del popup
function initPopupListeners() {
    const closeBtn = document.querySelector('.ex-close-popup-btn');
    const popupOverlay = document.querySelector('.ex-popup-overlay');
    const prevBtn = document.getElementById('prev-step');
    const nextBtn = document.getElementById('next-step');

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeExercisePopup();
        };
    }

    if (popupOverlay) {
        popupOverlay.onclick = (e) => {
            // Chiudi solo se il click è esattamente sull'overlay (lo sfondo oscurato)
            if (e.target === popupOverlay) {
                console.log('Click su overlay rilevato, chiusura popup');
                closeExercisePopup();
            }
        };
    }

    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentStepIndex > 0) {
                currentStepIndex--;
                updateStepDisplay();
            }
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentStepIndex < currentInstructions.length - 1) {
                currentStepIndex++;
                updateStepDisplay();
            }
        };
    }
}

// Rimosso il vecchio blocco DOMContentLoaded del popup duplicato


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

// Variabile per gestire l'ID dell'animazione corrente
let counterAnimationId = null;

// Function to animate counter
function animateCounter(id, target, duration) {
    const element = document.getElementById(id);
    if (!element) return;

    // Cancella l'animazione precedente se ancora in corso
    if (counterAnimationId) {
        cancelAnimationFrame(counterAnimationId);
    }

    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function: easeOutExpo per un effetto più fluido
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        const currentCount = Math.floor(easeProgress * target);
        element.textContent = currentCount;
        
        if (progress < 1) {
            counterAnimationId = requestAnimationFrame(update);
        } else {
            element.textContent = target;
            counterAnimationId = null;
        }
    }
    
    counterAnimationId = requestAnimationFrame(update);
}

// Observer for the counter animation - riparte ogni volta che entra nel viewport
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Velocità aumentata: da 2500ms a 1200ms
            animateCounter('exercise-counter', 1324, 1200);
        } else {
            // Resetta il contatore a 0 quando esce dalla visuale per farlo ripartire da zero la prossima volta
            const element = document.getElementById('exercise-counter');
            if (element) element.textContent = "0";
            if (counterAnimationId) {
                cancelAnimationFrame(counterAnimationId);
                counterAnimationId = null;
            }
        }
    });
}, { threshold: 0.1 }); // Soglia ridotta per farlo partire non appena appare un po' del contatore

// Initialize the application
async function init() {
    // Start observing the counter if it exists
    const counterElement = document.getElementById('exercise-counter');
    if (counterElement) {
        counterObserver.observe(counterElement);
    }

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

// Sidebar routine list scroll gradient
const routineList = document.getElementById('user-routine-list-sidebar');
if (routineList) {
    routineList.addEventListener('scroll', () => {
        if (routineList.scrollTop > 0) {
            routineList.classList.add('scrolled');
        } else {
            routineList.classList.remove('scrolled');
        }
    });
}

// Avvia l'applicazione quando la pagina è pronta
window.addEventListener('DOMContentLoaded', () => {
    init();
    initPopupListeners(); // Inizializza i listener del popup
    
    // Pricing Toggle Logic
    const pricingToggle = document.getElementById('pricing-toggle');
    const prices = document.querySelectorAll('.price');
    const monthlyLabel = document.querySelector('.toggle-label.monthly');
    const yearlyLabel = document.querySelector('.toggle-label.yearly');

    if (pricingToggle) {
        // Aggiungi click listener alle label per attivare il toggle
        monthlyLabel?.addEventListener('click', () => {
            if (pricingToggle.checked) {
                pricingToggle.checked = false;
                pricingToggle.dispatchEvent(new Event('change'));
            }
        });

        yearlyLabel?.addEventListener('click', () => {
            if (!pricingToggle.checked) {
                pricingToggle.checked = true;
                pricingToggle.dispatchEvent(new Event('change'));
            }
        });

        pricingToggle.addEventListener('change', () => {
            const isYearly = pricingToggle.checked;
            
            // Toggle active classes on labels
            monthlyLabel?.classList.toggle('active', !isYearly);
            yearlyLabel?.classList.toggle('active', isYearly);

            prices.forEach(price => {
                const monthlyPrice = price.getAttribute('data-monthly');
                const yearlyPrice = price.getAttribute('data-yearly');
                
                if (isYearly) {
                    price.innerHTML = `${yearlyPrice}<span>/mese</span>`;
                } else {
                    price.innerHTML = `${monthlyPrice}<span>/mese</span>`;
                }
            });

            // Update mobile button prices
            const mobilePrices = document.querySelectorAll('.mobile-plan-btn .plan-price');
            mobilePrices.forEach(priceSpan => {
                const monthlyPrice = priceSpan.getAttribute('data-monthly');
                const yearlyPrice = priceSpan.getAttribute('data-yearly');
                priceSpan.textContent = isYearly ? yearlyPrice : monthlyPrice;
            });
        });
    }

    // Mobile Plan Selector Logic
    const mobilePlanBtns = document.querySelectorAll('.mobile-plan-btn');
    const pricingCards = document.querySelectorAll('.pricing-card');

    mobilePlanBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedPlan = btn.getAttribute('data-plan');
            
            // Add click animation
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 100);

            // Update buttons
            mobilePlanBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update cards with animation
            pricingCards.forEach(card => {
                if (card.getAttribute('data-plan') === selectedPlan) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        });
    });
});