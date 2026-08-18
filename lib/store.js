'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CAMERAS, PLANS } from '@/data/defaultData';

// Navigation (which plan/camera you're looking at) is per-visitor and
// stays in localStorage. The camera list itself (positions, names,
// markers) is shared editable content and lives in /api/state instead, so
// every visitor's page load reflects the latest saved edits.
const NAV_STORAGE_KEY = '360viewer-nav-v1';
const SAVE_DEBOUNCE_MS = 700;

function defaultNav() {
  return { currentPlan: 'A', currentCameraId: DEFAULT_CAMERAS[0].id };
}

function readStoredNav() {
  try {
    const raw = window.localStorage.getItem(NAV_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.currentPlan === 'string' && typeof parsed.currentCameraId === 'string') {
        return parsed;
      }
    }
  } catch (e) {
    // ignore corrupt storage
  }
  return null;
}

let markerCounter = 1;

const ViewerContext = createContext(null);

export function ViewerProvider({ children }) {
  const [cameras, setCameras] = useState(DEFAULT_CAMERAS);
  const [camerasLoaded, setCamerasLoaded] = useState(false);
  const [nav, setNav] = useState(defaultNav);
  const [editMode, setEditMode] = useState(false);
  const skipNextSave = useRef(true);

  // Load: per-visitor nav from localStorage, shared cameras from the API.
  useEffect(() => {
    const storedNav = readStoredNav();
    if (storedNav) setNav(storedNav);

    let cancelled = false;
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.cameras) && data.cameras.length > 0) {
          setCameras(data.cameras);
        }
      })
      .catch(() => {
        // Shared storage not reachable (e.g. not configured yet) — fall
        // back to the built-in defaults already in state.
      })
      .finally(() => {
        if (!cancelled) setCamerasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(nav));
    } catch (e) {
      // ignore
    }
  }, [nav]);

  // Save: debounced so a drag gesture (many rapid position updates) sends
  // one request instead of one per pointer move.
  useEffect(() => {
    if (!camerasLoaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameras }),
      }).catch(() => {
        // Best-effort: the edit still applies locally for this session
        // even if the shared save fails.
      });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [cameras, camerasLoaded]);

  // If the current camera was removed (by this visitor or another one),
  // fall back to the first one that still exists.
  useEffect(() => {
    if (!camerasLoaded || cameras.length === 0) return;
    if (!cameras.some((c) => c.id === nav.currentCameraId)) {
      setNav((s) => ({ ...s, currentCameraId: cameras[0].id }));
    }
  }, [cameras, camerasLoaded, nav.currentCameraId]);

  const currentPlan = nav.currentPlan;
  const currentCameraId = nav.currentCameraId;
  const currentCamera = useMemo(
    () => cameras.find((c) => c.id === currentCameraId) || cameras[0],
    [cameras, currentCameraId]
  );

  const setCurrentPlan = useCallback((planId) => {
    setNav((s) => ({ ...s, currentPlan: planId }));
  }, []);

  const setCurrentCameraId = useCallback((id) => {
    setNav((s) => ({ ...s, currentCameraId: id }));
  }, []);

  const renameCamera = useCallback((id, name) => {
    setCameras((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const deleteCamera = useCallback((id) => {
    setCameras((cs) => {
      const remaining = cs.filter((c) => c.id !== id);
      if (remaining.length === 0) return cs; // keep at least one camera
      return remaining.map((c) => ({
        ...c,
        markers: c.markers.filter((m) => m.targetId !== id),
      }));
    });
  }, []);

  const updateCameraPosition = useCallback((id, x, y) => {
    setCameras((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));
  }, []);

  const addMarker = useCallback((cameraId, targetId, yaw, pitch) => {
    markerCounter += 1;
    const markerId = `m-${Date.now()}-${markerCounter}`;
    setCameras((cs) =>
      cs.map((c) =>
        c.id === cameraId ? { ...c, markers: [...c.markers, { id: markerId, targetId, yaw, pitch }] } : c
      )
    );
  }, []);

  const updateMarker = useCallback((cameraId, markerId, yaw, pitch) => {
    setCameras((cs) =>
      cs.map((c) =>
        c.id === cameraId
          ? { ...c, markers: c.markers.map((m) => (m.id === markerId ? { ...m, yaw, pitch } : m)) }
          : c
      )
    );
  }, []);

  const updateMarkerTarget = useCallback((cameraId, markerId, targetId) => {
    setCameras((cs) =>
      cs.map((c) =>
        c.id === cameraId
          ? { ...c, markers: c.markers.map((m) => (m.id === markerId ? { ...m, targetId } : m)) }
          : c
      )
    );
  }, []);

  const deleteMarker = useCallback((cameraId, markerId) => {
    setCameras((cs) =>
      cs.map((c) => (c.id === cameraId ? { ...c, markers: c.markers.filter((m) => m.id !== markerId) } : c))
    );
  }, []);

  const resetToDefaults = useCallback(() => {
    setCameras(DEFAULT_CAMERAS);
    setNav(defaultNav());
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
