(function() {
    const channel = new BroadcastChannel('fitsuite_session_channel');
    const SESSION_ACTIVE_KEY = 'fitsuite_session_active_tab_id'; // Ora memorizza l'ID della scheda attiva
    const myTabId = Date.now() + '-' + Math.random().toString(36).substr(2, 9); // ID univoco per questa scheda
    let isCurrentTabActive = false; // Inizialmente, nessuna scheda è attiva
    let activationTimeout = null; // Per gestire il ritardo di attivazione

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'session-overlay';
        overlay.className = 'modal-session'; // Usa la nuova classe CSS
        overlay.innerHTML = `
            <div class="modal-session-content">
                <h3>FitSuite è aperto in un'altra scheda.</h3>
                <p>Per continuare a usare FitSuite qui, clicca sul pulsante qui sotto. La sessione nell'altra scheda verrà bloccata.</p>
                <div class="modal-session-actions">
                    <button id="activate-session-btn" class="modal-session-btn-primary">Usa questa sessione</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('activate-session-btn').addEventListener('click', () => {
            activateCurrentTab();
        });
    }

    function showOverlay() {
        let overlay = document.getElementById('session-overlay');
        if (!overlay) {
            createOverlay();
            overlay = document.getElementById('session-overlay');
        }
        overlay.classList.add('active'); // Aggiungi la classe 'active'
        isCurrentTabActive = false; // Se l'overlay è mostrato, questa scheda non è attiva
        console.log(`[${myTabId}] Mostro overlay.`);
    }

    function hideOverlay() {
        const overlay = document.getElementById('session-overlay');
        if (overlay) {
            overlay.classList.remove('active'); // Rimuovi la classe 'active'
        }
        isCurrentTabActive = true;
        console.log(`[${myTabId}] Nascondo overlay.`);
    }

    function activateCurrentTab() {
        localStorage.setItem(SESSION_ACTIVE_KEY, myTabId); // Questa scheda è ora attiva
        channel.postMessage({ type: 'activate_tab', tabId: myTabId }); // Annuncia l'attivazione
        isCurrentTabActive = true;
        hideOverlay();
        console.log(`[${myTabId}] Questa scheda è ora attiva.`);
    }

    // Ascolta i messaggi dalle altre schede
    channel.onmessage = (event) => {
        if (event.data.type === 'activate_tab') {
            // Un'altra scheda (o questa stessa) è stata attivata
            if (event.data.tabId !== myTabId) {
                // Se un'altra scheda si è attivata, questa deve mostrare l'overlay
                if (activationTimeout) {
                    clearTimeout(activationTimeout); // Annulla l'attivazione in sospeso di questa scheda
                    activationTimeout = null;
                }
                if (isCurrentTabActive) {
                    isCurrentTabActive = false; // Non siamo più la scheda attiva
                }
                showOverlay();
                console.log(`[${myTabId}] Ricevuto 'activate_tab' da ${event.data.tabId}. Mostro overlay.`);
            } else {
                // Questa scheda ha ricevuto il suo stesso messaggio di attivazione, ignora
                console.log(`[${myTabId}] Ricevuto il mio stesso 'activate_tab'.`);
            }
        } else if (event.data.type === 'new_tab_opened') {
            // Un'altra scheda si è appena aperta. Se questa è la scheda attiva, glielo comunichiamo.
            if (isCurrentTabActive) {
                channel.postMessage({ type: 'active_tab_exists', activeTabId: myTabId, newTabId: event.data.tabId });
                console.log(`[${myTabId}] Sono attivo, rispondo a 'new_tab_opened' da ${event.data.tabId}.`);
            }
        } else if (event.data.type === 'active_tab_exists') {
            // Abbiamo aperto una nuova scheda e un'altra scheda ha risposto che è attiva.
            // Se il messaggio è per noi e la scheda che ha risposto è quella attiva in localStorage, mostriamo l'overlay.
            if (event.data.newTabId === myTabId) { // Il messaggio è per questa scheda
                const currentActiveInStorage = localStorage.getItem(SESSION_ACTIVE_KEY);
                if (event.data.activeTabId === currentActiveInStorage) {
                    if (activationTimeout) {
                        clearTimeout(activationTimeout);
                        activationTimeout = null;
                    }
                    showOverlay();
                    console.log(`[${myTabId}] Ricevuto 'active_tab_exists' da ${event.data.activeTabId}. Mostro overlay.`);
                }
            }
        }
    };

    // All'apertura della pagina, annuncia la presenza e tenta di reclamare la sessione dopo un breve ritardo
    window.addEventListener('load', () => {
        console.log(`[${myTabId}] Pagina caricata.`);
        const storedActiveTabId = localStorage.getItem(SESSION_ACTIVE_KEY);

        if (!storedActiveTabId) {
            // Nessuna scheda attiva registrata, questa scheda può diventare attiva immediatamente
            activateCurrentTab();
            console.log(`[${myTabId}] Nessuna scheda attiva memorizzata, mi attivo.`);
        } else if (storedActiveTabId === myTabId) {
            // Questa scheda era l'ultima attiva, la riattivo
            activateCurrentTab();
            console.log(`[${myTabId}] Ero l'ultima attiva, mi riattivo.`);
        } else {
            // C'è un'altra scheda che si dichiara attiva. Annuncio la mia presenza e aspetto.
            channel.postMessage({ type: 'new_tab_opened', tabId: myTabId });
            console.log(`[${myTabId}] Scheda attiva memorizzata è ${storedActiveTabId}, annuncio la mia presenza.`);

            // Imposta un timeout per reclamare l'attivazione se nessun'altra scheda attiva risponde
            activationTimeout = setTimeout(() => {
                const currentActiveInStorage = localStorage.getItem(SESSION_ACTIVE_KEY);
                if (currentActiveInStorage === storedActiveTabId) {
                    // L'altra scheda non ha risposto o non esiste più. Questa scheda diventa attiva.
                    activateCurrentTab();
                    console.log(`[${myTabId}] Timeout raggiunto, nessuna risposta da ${storedActiveTabId}, mi attivo.`);
                } else if (currentActiveInStorage === myTabId) {
                    // Siamo già diventati attivi (es. l'utente ha cliccato il pulsante attiva)
                    console.log(`[${myTabId}] Timeout raggiunto, ma sono già attivo.`);
                } else {
                    // Un'altra scheda è diventata attiva nel frattempo, quindi dobbiamo mostrare l'overlay
                    showOverlay();
                    console.log(`[${myTabId}] Timeout raggiunto, ma un'altra scheda (${currentActiveInStorage}) è diventata attiva, mostro overlay.`);
                }
                activationTimeout = null;
            }, 300); // Breve ritardo per permettere alle altre schede di rispondere
        }
    });

    // Gestisce la chiusura/aggiornamento della scheda
    window.addEventListener('beforeunload', () => {
        if (isCurrentTabActive) {
            // Se questa scheda era attiva, rimuovi il suo stato attivo
            localStorage.removeItem(SESSION_ACTIVE_KEY);
            console.log(`[${myTabId}] Ero attivo, ho rimosso la chiave di sessione.`);
        }
        if (activationTimeout) {
            clearTimeout(activationTimeout); // Pulisci qualsiasi timeout pendente
            activationTimeout = null;
        }
    });
})();