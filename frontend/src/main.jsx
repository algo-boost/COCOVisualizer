import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { ConfigProvider } from './LegacyApp.jsx';
import './styles/index.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <ConfigProvider>
      <App />
    </ConfigProvider>,
  );
}
