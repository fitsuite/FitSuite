document.addEventListener('DOMContentLoaded', () => {
    const loadFooter = async () => {
        try {
            // Load footer HTML
            const htmlResponse = await fetch('/frontend/templates/footer.html');
            const footerHtml = await htmlResponse.text();
            
            // Create a temporary div to hold the footer content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = footerHtml;

            // Append the footer to the body
            document.body.appendChild(tempDiv.firstElementChild);

            // Load footer CSS
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/frontend/templates/footer.css';
            document.head.appendChild(cssLink);

        } catch (error) {
            console.error('Error loading footer:', error);
        }
    };

    loadFooter();
});