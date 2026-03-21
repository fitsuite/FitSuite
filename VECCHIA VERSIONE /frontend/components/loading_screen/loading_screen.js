// Loading Screen Manager - Sistema unificato per la gestione della schermata di caricamento
class LoadingScreenManager {
    constructor() {
        this.element = null;
        this.progressBar = null;
        this.statusText = null;
        this.currentProgress = 0;
        this.isLoading = false;
        this.loadingSteps = [];
        this.currentStep = 0;
        this.init();
    }

    init() {
        // Crea o trova la loading screen
        this.element = document.getElementById('loading-screen');
        if (!this.element) {
            this.createLoadingScreen();
        }
        this.progressBar = this.element.querySelector('.progress-bar');
        this.statusText = this.element.querySelector('p');
        this.reset();
    }

    createLoadingScreen() {
        this.element = document.createElement('div');
        this.element.id = 'loading-screen';
        this.element.innerHTML = `
            <div class="logo footer-logo">FitSuite</div>
            <div class="spinner"></div>
            <div class="progress-bar-container">
                <div class="progress-bar"></div>
            </div>
            <p>Caricamento...</p>
        `;
        document.body.prepend(this.element);
    }

    show(steps = []) {
        if (!this.element) this.init();
        
        this.loadingSteps = steps.length > 0 ? steps : [
            'Inizializzazione...',
            'Caricamento preferenze...',
            'Caricamento dati...',
            'Preparazione interfaccia...'
        ];
        
        this.currentStep = 0;
        this.currentProgress = 0;
        this.isLoading = true;
        
        this.element.style.display = 'flex';
        this.updateProgress(0);
        this.updateStatus(this.loadingSteps[0]);
    }

    nextStep(message = null) {
        if (!this.isLoading) return;
        
        this.currentStep++;
        const progress = (this.currentStep / this.loadingSteps.length) * 100;
        
        if (message) {
            this.updateStatus(message);
        } else if (this.currentStep < this.loadingSteps.length) {
            this.updateStatus(this.loadingSteps[this.currentStep]);
        }
        
        this.updateProgress(progress);
    }

    updateProgress(percent) {
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }
        this.currentProgress = percent;
    }

    updateStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    hide() {
        if (!this.element) return;
        
        // Assicura che la progress bar sia al 100%
        this.updateProgress(100);
        this.updateStatus('Completato!');
        
        // Nasconde la loading screen dopo un breve delay per mostrare il completamento
        setTimeout(() => {
            this.element.style.display = 'none';
            this.isLoading = false;
            this.reset();
        }, 300);
    }

    reset() {
        this.currentStep = 0;
        this.currentProgress = 0;
        this.loadingSteps = [];
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
        }
        if (this.statusText) {
            this.statusText.textContent = 'Caricamento...';
        }
    }

    // Metodi di utilità per operazioni comuni
    showDatabaseLoading() {
        this.show([
            'Connessione al database...',
            'Recupero dati utente...',
            'Caricamento schede...',
            'Organizzazione dati...'
        ]);
    }

    showCacheLoading() {
        this.show([
            'Verifica cache...',
            'Caricamento da cache...',
            'Preparazione interfaccia...'
        ]);
    }

    showAIGeneration() {
        this.show([
            'Analisi richiesta...',
            'Generazione scheda AI...',
            'Elaborazione esercizi...',
            'Preparazione download...'
        ]);
    }
}

// Istanza globale del loading manager
window.LoadingManager = new LoadingScreenManager();

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza la loading screen se non esiste
    if (!document.getElementById('loading-screen')) {
        window.LoadingManager.init();
    }
});
