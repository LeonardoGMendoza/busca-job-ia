import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './estilo.css';

// sem StrictMode: ele monta os componentes duas vezes em desenvolvimento e criaria duas assistentes 3D
createRoot(document.getElementById('root')).render(<App />);
