(function() {
    // Create Popup HTML structure
    const popupHTML = `
        <div id="customPopup" class="custom-popup-overlay">
            <div class="custom-popup-content">
                <h3 id="customPopupTitle" class="custom-popup-title">Avviso</h3>
                <p id="customPopupMessage" class="custom-popup-message"></p>
                <input type="text" id="customPopupInput" class="custom-popup-input" style="display:none;">
                <div class="custom-popup-actions">
                    <button id="customPopupCancel" class="custom-popup-btn secondary" style="display:none;">Annulla</button>
                    <button id="customPopupOk" class="custom-popup-btn primary">OK</button>
                </div>
            </div>
        </div>
    `;

    let resolvePromise = null;

    // Append to body when DOM is ready
    function initPopup() {
        if (!document.getElementById('customPopup')) {
            document.body.insertAdjacentHTML('beforeend', popupHTML);
            
            const overlay = document.getElementById('customPopup');
            const okBtn = document.getElementById('customPopupOk');
            const cancelBtn = document.getElementById('customPopupCancel');
            const input = document.getElementById('customPopupInput');

            function closePopup(result) {
                overlay.classList.remove('show');
                if (resolvePromise) {
                    resolvePromise(result);
                    resolvePromise = null;
                }
            }

            okBtn.addEventListener('click', () => {
                if (input.style.display !== 'none') {
                    closePopup(input.value);
                } else {
                    closePopup(true);
                }
            });

            cancelBtn.addEventListener('click', () => {
                closePopup(null); // Or false for confirm
            });
            
            // Allow Enter key in input
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopup);
    } else {
        initPopup();
    }

    // Reset popup state
    function resetPopup() {
        const titleEl = document.getElementById('customPopupTitle');
        const messageEl = document.getElementById('customPopupMessage');
        const inputEl = document.getElementById('customPopupInput');
        const cancelBtn = document.getElementById('customPopupCancel');
        const okBtn = document.getElementById('customPopupOk');

        titleEl.textContent = '';
        messageEl.textContent = '';
        inputEl.value = '';
        inputEl.style.display = 'none';
        cancelBtn.style.display = 'none';
        okBtn.textContent = 'OK';
        
        // Remove previous event listeners if any (cloning to remove)
        // Actually we used a static listener that calls resolvePromise, which we update.
        // So no need to remove listeners.
    }

    // Override window.alert
    window.alert = function(message, title = 'Avviso') {
        return new Promise((resolve) => {
            if (!document.getElementById('customPopup')) initPopup();
            
            resetPopup();
            
            const popup = document.getElementById('customPopup');
            const titleEl = document.getElementById('customPopupTitle');
            const messageEl = document.getElementById('customPopupMessage');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            resolvePromise = resolve;
            popup.classList.add('show');
        });
    };

    // Custom Confirm
    window.showConfirm = function(message, title = 'Conferma') {
        return new Promise((resolve) => {
            if (!document.getElementById('customPopup')) initPopup();
            
            resetPopup();
            
            const popup = document.getElementById('customPopup');
            const titleEl = document.getElementById('customPopupTitle');
            const messageEl = document.getElementById('customPopupMessage');
            const cancelBtn = document.getElementById('customPopupCancel');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            cancelBtn.style.display = 'inline-block';
            
            resolvePromise = (result) => {
                // If result is null (cancel clicked), resolve false
                // If result is true (ok clicked), resolve true
                resolve(!!result);
            };
            
            popup.classList.add('show');
        });
    };

    // Custom Prompt
    window.showPrompt = function(message, defaultValue = '', title = 'Inserisci') {
        return new Promise((resolve) => {
            if (!document.getElementById('customPopup')) initPopup();
            
            resetPopup();
            
            const popup = document.getElementById('customPopup');
            const titleEl = document.getElementById('customPopupTitle');
            const messageEl = document.getElementById('customPopupMessage');
            const inputEl = document.getElementById('customPopupInput');
            const cancelBtn = document.getElementById('customPopupCancel');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.value = defaultValue;
            inputEl.style.display = 'block';
            cancelBtn.style.display = 'inline-block';
            
            // Focus input after a small delay to allow transition
            setTimeout(() => inputEl.focus(), 100);
            
            resolvePromise = resolve;
            popup.classList.add('show');
        });
    };

})();
