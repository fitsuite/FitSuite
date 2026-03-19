/**
 * FitSuite Cookie UI Manager
 * Gestisce l'interfaccia utente del banner dei cookie.
 */

const CookieUI = {
    bannerId: 'fitsuite-cookie-banner',
    settingsId: 'fitsuite-cookie-settings',
    
    /**
     * Inizializza l'interfaccia
     */
    init: function() {
        if (!window.CookieManager.checkConsent()) {
            this.showBanner();
        }
        this.addRevokeButton();
    },

    /**
     * Mostra il banner nel DOM
     */
    showBanner: function() {
        if (document.getElementById(this.bannerId)) return;

        const banner = document.createElement('div');
        banner.id = this.bannerId;
        
        // Link alla Privacy Policy (presumibilmente in frontend/legal/privacy.html)
        const privacyLink = '/frontend/legal/privacy.html';

        // Recupera lo stato attuale per pre-selezionare i toggle
        const consent = window.CookieManager.getConsentState() || {
            preferences: false,
            analytics: false,
            marketing: false
        };

        banner.innerHTML = `
            <div class="banner-header">
                <h3>🍪 La tua Privacy</h3>
                <button class="close-btn" id="cookie-close-x" title="Rifiuta">&times;</button>
            </div>
            <p>
                Utilizziamo cookie per migliorare la tua esperienza. 
                Puoi accettare tutto, rifiutare i non necessari o <a href="${privacyLink}" target="_blank">leggere di più</a>.
            </p>
            
            <div id="${this.settingsId}" style="display: none;">
                <div class="cookie-option">
                    <div class="cookie-info">
                        <h4>Necessari</h4>
                        <p style="font-size: 0.75rem; color: #94a3b8; margin: 0;">Inclusi: sessione, sicurezza e preferenze (tema/lingua)</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" checked disabled>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="cookie-option">
                    <div class="cookie-info">
                        <h4>Statistici</h4>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="cookie-pref-stats" ${consent.analytics ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="cookie-option">
                    <div class="cookie-info">
                        <h4>Marketing</h4>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="cookie-pref-mark" ${consent.marketing ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 5px;" id="cookie-save-custom">Salva</button>
            </div>

            <div class="banner-actions" id="cookie-main-actions">
                <button class="btn btn-primary" id="cookie-accept-all">Accetta</button>
                <button class="btn btn-secondary" id="cookie-reject-all">Rifiuta</button>
                <button class="btn btn-outline" id="cookie-customize">Personalizza</button>
            </div>
        `;

        document.body.appendChild(banner);
        this.bindEvents();
    },

    /**
     * Collega gli eventi ai pulsanti
     */
    bindEvents: function() {
        const self = this;
        
        // Accetta tutto
        document.getElementById('cookie-accept-all').addEventListener('click', () => {
            window.CookieManager.saveConsent({
                preferences: true,
                analytics: true,
                marketing: true
            });
            self.removeBanner();
        });

        // Rifiuta non necessari (o chiudi con X)
        const rejectFn = () => {
            window.CookieManager.saveConsent({
                preferences: false,
                analytics: false,
                marketing: false
            });
            self.removeBanner();
        };

        document.getElementById('cookie-reject-all').addEventListener('click', rejectFn);
        document.getElementById('cookie-close-x').addEventListener('click', rejectFn);

        // Personalizza
        document.getElementById('cookie-customize').addEventListener('click', () => {
            document.getElementById(self.settingsId).style.display = 'flex';
            document.getElementById('cookie-main-actions').style.display = 'none';
        });

        // Salva personalizzati
        document.getElementById('cookie-save-custom').addEventListener('click', function() {
            const btn = this;
            const originalText = btn.innerHTML;
            
            window.CookieManager.saveConsent({
                analytics: document.getElementById('cookie-pref-stats').checked,
                marketing: document.getElementById('cookie-pref-mark').checked
            });
            
            // Feedback visivo istantaneo
            btn.innerHTML = '<i class="fas fa-check"></i> Salvato!';
            btn.style.backgroundColor = '#4ade80';
            btn.disabled = true;
            
            setTimeout(() => {
                self.removeBanner();
                // Ripristina per la prossima volta che si apre
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.backgroundColor = '';
                    btn.disabled = false;
                }, 500);
            }, 600);
        });
    },

    /**
     * Rimuove il banner dal DOM
     */
    removeBanner: function() {
        const banner = document.getElementById(this.bannerId);
        if (banner) {
            banner.style.animation = 'slideUp 0.3s ease-in reverse';
            setTimeout(() => banner.remove(), 300);
        }
    },

    /**
     * Aggiunge un piccolo tasto per revocare il consenso (icona ingranaggio/cookie)
     */
    addRevokeButton: function() {
        if (document.getElementById('fitsuite-cookie-revoke')) return;

        const btn = document.createElement('div');
        btn.id = 'fitsuite-cookie-revoke';
        btn.innerHTML = '<i class="fas fa-cookie-bite"></i>'; 
        btn.title = 'Gestisci preferenze cookie';
        
        btn.addEventListener('click', () => {
            this.showBanner();
            // Forza l'apertura della personalizzazione se il banner appare di nuovo
            setTimeout(() => {
                document.getElementById(this.settingsId).style.display = 'flex';
                document.getElementById('cookie-main-actions').style.display = 'none';
            }, 50);
        });

        document.body.appendChild(btn);
    }
};

// Inizializzazione - Gestita ora da CookieManager per evitare doppie chiamate
window.CookieUI = CookieUI;

// Carica il CSS se necessario (può essere fatto indipendentemente)
(function() {
    if (typeof document !== 'undefined' && !document.querySelector('link[href*="cookie_ui.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/backend/cookie/cookie_ui.css';
        // Gestione path per ambiente locale vs produzione
        if (window.location.pathname.includes('/FitSuite/')) {
            link.href = '/FitSuite/backend/cookie/cookie_ui.css';
        }
        document.head.appendChild(link);
    }
})();
