type LoadingListener = () => void;

let activeRequestCount = 0;
const listeners = new Set<LoadingListener>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function beginGlobalLoading(): void {
  activeRequestCount += 1;
  notifyListeners();
}

export function endGlobalLoading(): void {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  notifyListeners();
}

export function getIsGlobalLoading(): boolean {
  return activeRequestCount > 0;
}

export function subscribeToGlobalLoading(listener: LoadingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
