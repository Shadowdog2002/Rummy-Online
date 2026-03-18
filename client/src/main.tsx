import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { useAuthStore } from './store/authStore';
import { initSocket, disconnectSocket } from './socket';

// Initialize socket synchronously before first render so any component
// that calls getSocket() on mount (e.g. after a page refresh) won't throw.
const persistedToken = useAuthStore.getState().token;
if (persistedToken) initSocket(persistedToken);

// Closing the tab / navigating away logs the user out.
window.addEventListener('beforeunload', () => {
  disconnectSocket();
  useAuthStore.getState().clearAuth();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
