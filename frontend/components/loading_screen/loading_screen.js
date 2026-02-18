document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('loading-screen')) {
        const loadingScreen = document.createElement('div');
        loadingScreen.id = 'loading-screen';
        loadingScreen.innerHTML = `
            <div class="logo footer-logo">FitSuite</div>
            <div class="spinner"></div>
            <div class="progress-bar-container">
                <div class="progress-bar"></div>
            </div>
            <p>Caricamento...</p>
        `;
        document.body.prepend(loadingScreen);
    }
});
