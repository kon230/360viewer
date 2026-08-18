'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CAMERAS, PLANS } from '@/data/defaultData';

const STORAGE_KEY = '360viewer-state-v1';

function defaultState() {
  return { cameras: DEFAULT_CAMERAS, currentPlan: 'A', currentCameraId: DEFAULT_CAMERAS[0].id };
}

function readStoredState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.cameras) && parsed.cameras.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore corrupt storage
  }
  return null;
}

let cameraCounter = 1;
let markerCounter = 1;

const ViewerContext = createContext(null);

export function ViewerProvider({ children }) {
  // Always start from the deterministic default so server-rendered and
  // client-hydrated markup match; any saved edits are applied right after
  // mount (see effect below), once localStorage is actually available.
  const [state, setState] = useState(defaultState);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredState();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // storage full or unavailable; edits still work for this session
    }
  }, [state]);

  const cameras = state.cameras;
  const currentPlan = state.currentPlan;
  const currentCameraId = state.currentCameraId;
  const currentCamera = useMemo(
    () => cameras.find((c) => c.id === currentCameraId) || cameras[0],
    [cameras, currentCameraId]
  );

  const setCurrentPlan = useCallback((planId) => {
    setState((s) => ({ ...s, currentPlan: planId }));
  }, []);

  const setCurrentCameraId = useCallback((id) => {
    setState((s) => ({ ...s, currentCameraId: id }));
  }, []);

  const renameCamera = useCallback((id, name) => {
    setState((s) => ({
      ...s,
      cameras: s.cameras.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  }, []);

  const addCamera = useCallback(() => {
    setState((s) => {
      let n = s.cameras.length + 1;
      const existingNames = new Set(s.cameras.map((c) => c.name));
      let name = `カメラ${n}`;
      while (existingNames.has(name)) {
        n += 1;
        name = `カメラ${n}`;
      }
      cameraCounter += 1;
      const id = `cam-${Date.now()}-${cameraCounter}`;
      const newCamera = {
        id,
        name,
        x: 50,
        y: 50,
        images: { A: null, B: null, C: null },
        markers: [],
      };
      return { ...s, cameras: [...s.cameras, newCamera], currentCameraId: id };
    });
  }, []);

  const deleteCamera = useCallback((id) => {
    setState((s) => {
      const remaining = s.cameras.filter((c) => c.id !== id);
      if (remaining.length === 0) return s; // keep at least one camera
      const cleaned = remaining.map((c) => ({
        ...c,
        markers: c.markers.filter((m) => m.targetId !== id),
      }));
      const nextCurrent = s.currentCameraId === id ? cleaned[0].id : s.currentCameraId;
      return { ...s, cameras: cleaned, currentCameraId: nextCurrent };
    });
  }, []);

  const updateCameraPosition = useCallback((id, x, y) => {
    setState((s) => ({
      ...s,
      cameras: s.cameras.map((c) => (c.id === id ? { ...c, x, y } : c)),
    }));
  }, []);

  const addMarker = useCallback((cameraId, targetId, yaw, pitch) => {
    setState((s) => {
      markerCounter += 1;
      const markerId = `m-${Date.now()}-${markerCounter}`;
      return {
        ...s,
        cameras: s.cameras.map((c) =>
          c.id === cameraId
            ? { ...c, markers: [...c.markers, { id: markerId, targetId, yaw, pitch }] }
            : c
        ),
      };
    });
  }, []);

  const updateMarker = useCallback((cameraId, markerId, yaw, pitch) => {
    setState((s) => ({
      ...s,
      cameras: s.cameras.map((c) =>
        c.id === cameraId
          ? { ...c, markers: c.markers.map((m) => (m.id === markerId ? { ...m, yaw, pitch } : m)) }
          : c
      ),
    }));
  }, []);

  const updateMarkerTarget = useCallback((cameraId, markerId, targetId) => {
    setState((s) => ({
      ...s,
      cameras: s.cameras.map((c) =>
        c.id === cameraId
          ? { ...c, markers: c.markers.map((m) => (m.id === markerId ? { ...m, targetId } : m)) }
          : c
      ),
    }));
  }, []);

  const deleteMarker = useCallback((cameraId, markerId) => {
    setState((s) => ({
      ...s,
      cameras: s.cameras.map((c) =>
        c.id === cameraId ? { ...c, markers: c.markers.filter((m) => m.id !== markerId) } : c
      ),
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState({ cameras: DEFAULT_CAMERAS, currentPlan: 'A', currentCameraId: DEFAULT_CAMERAS[0].id });
  }, []);

  const value = {
    plans: PLANS,
    cameras,
    currentPlan,
    currentCamera,
    currentCameraId,
    editMode,
    setEditMode,
    setCurrentPlan,
    setCurrentCameraId,
    renameCamera,
    addCamera,
    deleteCamera,
    updateCameraPosition,
    addMarker,
    updateMarker,
    updateMarkerTarget,
    deleteMarker,
    resetToDefaults,
  };

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error('useViewer must be used within ViewerProvider');
  return ctx;
}
