'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { PanoramaEngine, makePlaceholderDataUrl } from '@/lib/panoramaEngine';

export default function PanoramaViewer({
  imageUrl,
  placeholderLabel,
  markers,
  otherCameras,
  editMode,
  onNavigate,
  onMarkerDelete,
  onMarkerTargetChange,
  onAddMarker,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const engineRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const engine = new PanoramaEngine(canvasRef.current, overlayRef.current);
    engineRef.current = engine;
    setReady(true);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const url = imageUrl || makePlaceholderDataUrl(placeholderLabel || '画像未設定', 210);
    engine.loadImage(url).catch(() => {});
  }, [imageUrl, placeholderLabel, ready]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setEditMode(editMode);
    if (!editMode) {
      setPlacing(false);
      setActiveMarkerId(null);
    }
  }, [editMode]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPlacingMode(placing);
    if (canvasRef.current) canvasRef.current.style.cursor = placing ? 'crosshair' : 'grab';
  }, [placing]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const decorated = markers.map((m) => {
      const target = otherCameras.find((c) => c.id === m.targetId);
      return { ...m, label: target ? `${target.name}へ` : '未設定' };
    });
    engine.setMarkers(decorated);
    // force a re-render so portal anchors (marker DOM elements) exist for new markers
    forceTick((t) => t + 1);
  }, [markers, otherCameras]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.on('markerClick', (id) => {
      if (editMode) {
        setActiveMarkerId((cur) => (cur === id ? null : id));
      } else {
        const marker = engine.markers.find((m) => m.id === id);
        if (marker && onNavigate) onNavigate(marker.targetId);
      }
    });
    engine.on('placeMarker', (yaw, pitch) => {
      setPlacing(false);
      if (onAddMarker) onAddMarker(yaw, pitch);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, onNavigate, onAddMarker]);

  const activeMarkerEl = activeMarkerId && engineRef.current ? engineRef.current.markerEls.get(activeMarkerId) : null;

  return (
    <div className="pano-viewer">
      <canvas ref={canvasRef} className="pano-canvas" />
      <div ref={overlayRef} className="pano-overlay" />

      {editMode && (
        <div className="pano-toolbar">
          <button
            type="button"
            className={`pano-toolbar-btn${placing ? ' active' : ''}`}
            onClick={() => setPlacing((p) => !p)}
            disabled={otherCameras.length === 0}
          >
            {placing ? 'クリックでマーカー配置...' : '+ マーカーを追加'}
          </button>
        </div>
      )}

      {activeMarkerEl &&
        createPortal(
          <MarkerPopover
            marker={markers.find((m) => m.id === activeMarkerId)}
            otherCameras={otherCameras}
            onChangeTarget={(targetId) => onMarkerTargetChange(activeMarkerId, targetId)}
            onDelete={() => {
              onMarkerDelete(activeMarkerId);
              setActiveMarkerId(null);
            }}
            onClose={() => setActiveMarkerId(null)}
          />,
          activeMarkerEl
        )}
    </div>
  );
}

function MarkerPopover({ marker, otherCameras, onChangeTarget, onDelete, onClose }) {
  if (!marker) return null;
  return (
    <div className="marker-popover" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="marker-popover-close" onClick={onClose} aria-label="閉じる">
        ×
      </button>
      <div className="marker-popover-row">
        <span>移動先</span>
        <select value={marker.targetId || ''} onChange={(e) => onChangeTarget(e.target.value)}>
          {otherCameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="marker-popover-delete" onClick={onDelete}>
        マーカーを削除
      </button>
    </div>
  );
}
