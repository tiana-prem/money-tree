import { useStore } from './store';
import { derive } from './derive';
import type { AppData } from './schema';

export function useData(): AppData {
  const d = useStore((s) => s.data);
  if (!d) throw new Error('No data loaded');
  return d;
}

export function useDerived() {
  return derive(useData());
}
