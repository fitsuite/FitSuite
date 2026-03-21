// 1. Cattura il percorso dello script immediatamente
const currentScript = document.currentScript;
const scriptSrc = currentScript ? currentScript.src : 'Non rilevato';

document.addEventListener('DOMContentLoaded', () => {
    const loadFooter = async () => {
        try {
            // Calcoliamo il percorso base (dove si trova footer.js)
            let basePath = '';
            if (currentScript && currentScript.src) {
                basePath = currentScript.src.substring(0, currentScript.src.lastIndexOf('/') + 1);
            } else {
                // Fallback se currentScript fallisce: usiamo il percorso relativo alla root
                basePath = 'frontend/templates/footer/';
            }

            console.log('--- DEBUG FOOTER ---');
            console.log('Script URL:', scriptSrc);
            console.log('Base Path calcolato:', basePath);
            console.log('Tentativo di fetch su:', basePath + 'footer.html');

            // 2. Carica l'HTML
            const htmlResponse = await fetch(basePath + 'footer.html');
            
            if (!htmlResponse.ok) {
                throw new Error(`File non trovato (404) al percorso: ${basePath}footer.html`);
            }
            
            const footerHtml = await htmlResponse.text();
            
            // 3. Inserimento nel DOM
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = footerHtml;
            const footerElement = tempDiv.firstElementChild;

            if (footerElement) {
                document.body.appendChild(footerElement);
                console.log('HTML del footer inserito correttamente.');
            }

            // 4. Carica il CSS
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = basePath + 'footer.css';
            document.head.appendChild(cssLink);
            console.log('CSS del footer collegato:', cssLink.href);

        } catch (error) {
            console.error('ERRORE DETTAGLIATO:', error.message);
            console.error('Stack trace:', error);
        }
    };

    loadFooter();
});