document.addEventListener('DOMContentLoaded', () => {
    const loadFooter = async () => {
        try {
            /* TRUCCO: Otteniamo il percorso di QUESTO file script (footer.js).
               In questo modo sappiamo sempre dove cercare footer.html e footer.css,
               indipendentemente se siamo nella Home o nella pagina di Login.
            */
            const scriptPath = document.currentScript.src;
            const basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);

            // 1. Carica footer.html usando il percorso base calcolato
            const htmlResponse = await fetch(basePath + 'footer.html');
            
            if (!htmlResponse.ok) {
                throw new Error(`Impossibile caricare il footer: ${htmlResponse.status}`);
            }
            
            const footerHtml = await htmlResponse.text();
            
            // 2. Crea un div temporaneo per parsare l'HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = footerHtml;

            // 3. Aggiungi il footer al body
            // Nota: Se il footer.html contiene già il tag <footer>, usiamo firstElementChild
            const footerElement = tempDiv.firstElementChild;
            if (footerElement) {
                document.body.appendChild(footerElement);
            } else {
                console.error("Il file footer.html sembra vuoto o non valido.");
            }

            // 4. Carica il CSS usando lo stesso percorso base
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = basePath + 'footer.css';
            document.head.appendChild(cssLink);

        } catch (error) {
            console.error('Errore nel caricamento del footer:', error);
        }
    };

    loadFooter();
});