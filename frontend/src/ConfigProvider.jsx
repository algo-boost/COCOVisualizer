import { createContext, useContext, useEffect, useState } from 'react';

const ConfigContext = createContext({ config: null, loading: true, error: null });

const FALLBACK_CONFIG = {
  api_base: '',
  default_dataset: null,
  features: {},
};

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/static/config.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : FALLBACK_CONFIG))
      .catch(() => FALLBACK_CONFIG)
      .then((cfg) => {
        if (cancelled) return;
        setConfig({ ...FALLBACK_CONFIG, ...(cfg || {}) });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, error }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
