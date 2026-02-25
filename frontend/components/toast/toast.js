class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = new Map();
        this.init();
    }

    init() {
        // Create container if it doesn't exist
        if (!document.querySelector('.toast-container')) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.toast-container');
        }
    }

    show(message, type = 'success', title = null, duration = 3000) {
        const toastId = Date.now().toString();
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.dataset.toastId = toastId;

        // Determine icon based on type
        let icon = 'fas fa-check-circle';
        if (type === 'error') icon = 'fas fa-exclamation-circle';
        if (type === 'warning') icon = 'fas fa-exclamation-triangle';

        // Determine title based on type
        if (!title) {
            if (type === 'success') title = 'Operazione completata';
            if (type === 'error') title = 'Errore';
            if (type === 'warning') title = 'Attenzione';
        }

        toast.innerHTML = `
            <div class="toast-header">
                <div class="toast-title">
                    <i class="${icon} toast-icon"></i>
                    <span>${title}</span>
                </div>
                <button class="toast-close" aria-label="Chiudi">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="toast-message">${message}</div>
            <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
        `;

        // Add to container
        this.container.appendChild(toast);

        // Store reference
        this.toasts.set(toastId, toast);

        // Bind close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toastId));

        // Auto remove after duration
        setTimeout(() => {
            this.remove(toastId);
        }, duration);

        return toastId;
    }

    success(message, title = null, duration = 3000) {
        return this.show(message, 'success', title, duration);
    }

    error(message, title = null, duration = 5000) {
        return this.show(message, 'error', title, duration);
    }

    warning(message, title = null, duration = 4000) {
        return this.show(message, 'warning', title, duration);
    }

    remove(toastId) {
        const toast = this.toasts.get(toastId);
        if (toast && !toast.classList.contains('removing')) {
            toast.classList.add('removing');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(toastId);
            }, 300);
        }
    }

    clear() {
        this.toasts.forEach((toast, toastId) => {
            this.remove(toastId);
        });
    }
}

// Create global instance
window.ToastManager = new ToastManager();

// Global convenience functions
window.showToast = (message, type = 'success', title = null, duration = 3000) => {
    return window.ToastManager.show(message, type, title, duration);
};

window.showSuccessToast = (message, title = null, duration = 3000) => {
    return window.ToastManager.success(message, title, duration);
};

window.showErrorToast = (message, title = null, duration = 5000) => {
    return window.ToastManager.error(message, title, duration);
};

window.showWarningToast = (message, title = null, duration = 4000) => {
    return window.ToastManager.warning(message, title, duration);
};

// Replace the old showAlert function
window.showAlert = async (message, title = null) => {
    // Determine type based on message content
    let type = 'success';
    if (message.toLowerCase().includes('errore') || message.toLowerCase().includes('error')) {
        type = 'error';
    } else if (message.toLowerCase().includes('attenzione') || message.toLowerCase().includes('warning')) {
        type = 'warning';
    }
    
    return window.showToast(message, type, title);
};

// Replace the old showConfirm function
window.showConfirm = function(message, title = 'Conferma') {
    return new Promise((resolve) => {
        // Create a custom confirmation toast
        const toastId = window.ToastManager.show(message, 'warning', title, 0); // No auto-dismiss
        
        // Get the toast element
        const toast = window.ToastManager.toasts.get(toastId);
        if (!toast) {
            resolve(false);
            return;
        }
        
        // Add custom buttons to the toast
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'toast-actions';
        actionsDiv.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 12px;
            justify-content: flex-end;
        `;
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'toast-confirm-btn';
        confirmBtn.textContent = 'Conferma';
        confirmBtn.style.cssText = `
            background: #4ade80;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
        `;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'toast-cancel-btn';
        cancelBtn.textContent = 'Annulla';
        cancelBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
        `;
        
        // Add hover effects
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = '#22c55e';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = '#4ade80';
        });
        
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        
        // Add click handlers
        confirmBtn.addEventListener('click', () => {
            window.ToastManager.remove(toastId);
            resolve(true);
        });
        
        cancelBtn.addEventListener('click', () => {
            window.ToastManager.remove(toastId);
            resolve(false);
        });
        
        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(confirmBtn);
        
        // Insert actions after the message
        const messageDiv = toast.querySelector('.toast-message');
        if (messageDiv) {
            messageDiv.parentNode.insertBefore(actionsDiv, messageDiv.nextSibling);
        }
        
        // Remove progress bar for confirmation toasts
        const progressBar = toast.querySelector('.toast-progress');
        if (progressBar) {
            progressBar.style.display = 'none';
        }
    });
};
