document.addEventListener('DOMContentLoaded', () => {
    // Welcome Modal Logic
    const modal = document.getElementById('welcomeModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const exploreButton = document.getElementById('exploreButton');
    const body = document.body;

    // Function to open the modal
    const openModal = () => {
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                body.classList.add('modal-open');
            }, 10); // Short delay to allow display property to apply before transition
        }
    };

    // Function to close the modal
    const closeModal = () => {
        if (modal) {
            modal.classList.add('opacity-0');
            body.classList.remove('modal-open');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300); // Wait for transition to finish
            
            // Set a flag in localStorage so the modal doesn't show again
            try {
                localStorage.setItem('brumOutloudVisited', 'true');
            } catch (e) {
                console.error("LocalStorage is not available.", e);
            }
        }
    };

    // Check if the user has visited before
    const hasVisited = localStorage.getItem('brumOutloudVisited');

    if (!hasVisited) {
        // If it's the first visit, show the modal after a short delay
        setTimeout(openModal, 1000);
    }

    // Event listeners to close the modal
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeModal);
    }
    if (exploreButton) {
        exploreButton.addEventListener('click', closeModal);
    }
    
    // Optional: Close modal if user clicks on the background overlay
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});
