import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// The first version kept example data in the browser. Real data lives in Supabase now.
try {
  localStorage.removeItem('joat-demo-v1');
} catch {
  // Storage blocked: nothing to tidy.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
