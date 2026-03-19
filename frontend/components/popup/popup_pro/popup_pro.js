(function() {
    // Premium Popup CSS
    const premiumPopupCSS = `
        .premium-popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 11000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 20px;
        }

        .premium-popup-overlay.show {
            opacity: 1;
            visibility: visible;
        }

        .premium-popup-content {
            background: linear-gradient(145deg, #1e1e1e 0%, #121212 100%);
            border: 1px solid rgba(255, 184, 0, 0.3);
            border-radius: 24px;
            padding: 3rem 2rem;
            max-width: 450px;
            width: 100%;
            text-align: center;
            position: relative;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 30px rgba(255, 184, 0, 0.1);
            transform: scale(0.9) translateY(20px);
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            overflow: hidden;
        }

        .premium-popup-overlay.show .premium-popup-content {
            transform: scale(1) translateY(0);
        }

        .premium-icon-container {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, var(--primary-color, #ff6600) 0%, rgba(var(--primary-color-rgb, 255, 102, 0), 0.7) 100%);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 1.5rem;
            box-shadow: 0 10px 20px rgba(var(--primary-color-rgb, 255, 102, 0), 0.3);
            position: relative;
        }

        .premium-icon-container i {
            font-size: 2.5rem;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .premium-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #fff;
            color: var(--primary-color, #ff6600);
            font-size: 0.7rem;
            font-weight: 800;
            padding: 4px 8px;
            border-radius: 10px;
            text-transform: uppercase;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .premium-popup-title {
            font-size: 1.8rem;
            font-weight: 800;
            color: #fff;
            margin-bottom: 1rem;
            letter-spacing: -0.5px;
        }

        .premium-popup-title span {
            color: var(--primary-color, #ff6600);
            background: none;
            -webkit-background-clip: unset;
            -webkit-text-fill-color: unset;
        }

        .premium-popup-message {
            font-size: 1.1rem;
            color: #a0a0a0;
            line-height: 1.6;
            margin-bottom: 2.5rem;
        }

        .premium-popup-actions {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .premium-btn-primary {
            background: linear-gradient(135deg, var(--primary-color, #ff6600) 0%, rgba(var(--primary-color-rgb, 255, 102, 0), 0.7) 100%);
            color: white;
            font-weight: 700;
            font-size: 1.1rem;
            padding: 1.2rem;
            border-radius: 16px;
            border: none;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 10px 20px rgba(var(--primary-color-rgb, 255, 102, 0), 0.2);
        }

        .premium-btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 30px rgba(var(--primary-color-rgb, 255, 102, 0), 0.3);
            filter: brightness(1.1);
        }

        .premium-btn-secondary {
            background: transparent;
            color: #666;
            font-weight: 600;
            font-size: 0.95rem;
            padding: 0.8rem;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .premium-btn-secondary:hover {
            color: #fff;
        }

        .premium-glow {
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(var(--primary-color-rgb, 255, 102, 0), 0.05) 0%, transparent 70%);
            pointer-events: none;
            z-index: -1;
        }

        @media (max-width: 480px) {
            .premium-popup-content {
                padding: 2.5rem 1.5rem;
                margin: 0 15px;
            }
            .premium-popup-title { font-size: 1.5rem; }
            .premium-popup-message { font-size: 1rem; }
        }
    `;

    // Premium Popup HTML structure
    const premiumPopupHTML = `
        <div id="premiumPopup" class="premium-popup-overlay">
            <div class="premium-popup-content">
                <div class="premium-glow"></div>
                <div class="premium-icon-container">
                    <i class="fas fa-crown"></i>
                    <span class="premium-badge">PRO</span>
                </div>
                <h3 class="premium-popup-title">Sblocca <span>FitSuite Pro</span></h3>
                <p class="premium-popup-message">
                    Continua con una versione superiore per accedere a questa funzionalità esclusiva e massimizzare i tuoi risultati!
                </p>
                <div class="premium-popup-actions">
                    <a href="../scelta_piano/scelta_piano.html" id="premiumPopupBtn" class="premium-btn-primary">
                        <span>SCOPRI I PIANI</span>
                        <i class="fas fa-arrow-right"></i>
                    </a>
                    <button id="premiumPopupClose" class="premium-btn-secondary">
                        Magari più tardi
                    </button>
                </div>
            </div>
        </div>
    `;

    // Function to push history state for back button support
    function pushPremiumState() {
        if (!history.state || !history.state.premiumPopupOpen) {
            history.pushState({ premiumPopupOpen: true }, '');
        }
    }

    // Initialize the popup in the DOM
    function initPremiumPopup() {
        if (!document.getElementById('premiumPopup')) {
            // Inject CSS
            const style = document.createElement('style');
            style.textContent = premiumPopupCSS;
            document.head.appendChild(style);

            // Inject HTML
            document.body.insertAdjacentHTML('beforeend', premiumPopupHTML);
            
            const overlay = document.getElementById('premiumPopup');
            const closeBtn = document.getElementById('premiumPopupClose');
            const mainBtn = document.getElementById('premiumPopupBtn');

            function closePopup(fromBackAction = false) {
                overlay.classList.remove('show');
                
                // If closed manually (not from back button), go back in history
                if (!fromBackAction && history.state && history.state.premiumPopupOpen) {
                    history.back();
                }
            }

            closeBtn.addEventListener('click', () => closePopup());
            
            // Close on overlay click (outside content)
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePopup();
            });

            // Listen for popstate to close popup when back button is pressed
            window.addEventListener('popstate', (event) => {
                if (overlay.classList.contains('show')) {
                    closePopup(true);
                }
            });
        }
    }

    // Expose the show function globally
    window.showPremiumPopup = function(customMessage = null) {
        if (!document.getElementById('premiumPopup')) {
            initPremiumPopup();
        }
        
        const overlay = document.getElementById('premiumPopup');
        const messageEl = overlay.querySelector('.premium-popup-message');
        
        if (customMessage) {
            messageEl.textContent = customMessage;
        } else {
            messageEl.textContent = "Continua con una versione superiore per accedere a questa funzionalità esclusiva e massimizzare i tuoi risultati!";
        }
        
        pushPremiumState();
        overlay.classList.add('show');
    };

    // Auto-init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPremiumPopup);
    } else {
        initPremiumPopup();
    }
})();
