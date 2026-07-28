import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ServerWakeup } from './components/ServerWakeup';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ServerWakeup>
        <App />
      </ServerWakeup>
    </BrowserRouter>
  </React.StrictMode>
);
