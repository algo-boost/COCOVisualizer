import { useCallback, useState } from 'react';
import { loadDataset, loadDatasetMerged } from '../api/datasets.js';

export function useDataset() {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDataset(payload);
      setDataset(data);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMerged = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadDatasetMerged(payload);
      setDataset(data);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { dataset, loading, error, load, loadMerged, setDataset };
}
