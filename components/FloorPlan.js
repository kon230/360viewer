'use client';

import { useRef } from 'react';
import { FLOORPLAN_IMAGE } from '@/data/defaultData';

function CameraGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 8.5C4 7.67 4.67 7 5.5 7h2.1l.9-1.5A1.5 1.5 0 0 1 9.79 4.7h4.42c.53 0 1.02.28 1.29.75L16.4 7h2.1c.83 0 1.5.67 1.5 1.5v8c0 .83-.67 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function FloorPlan({ cameras, currentCameraId, editMode, onSelect, onMove }) {
  const containerRef = useRef(null);
  const dragId = useRef(null);
  const moved = useRef(false);
  const downPos = useRef({ x: 0, y: 0 });

  function handlePointerDown(e, id) {
    e.stopPropagation();
    dragId.current = id;
    moved.current = false;
    downPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragId.current || !containerRef.current) return;
    if (Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y) > 3) {
      moved.current = true;
    }
    if (!editMode) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    onMove(dragId.current, x, y);
  }

  function handlePointerUp() {
    if (dragId.current && !moved.current) {
      onSelect(dragId.current);
    }
    dragId.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="floorplan"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOORPLAN_IMAGE} alt="平面図" className="floorplan-img" draggable={false} />
      {cameras.map((cam) => (
        <button
          key={cam.id}
          type="button"
          className={`floorplan-pin${cam.id === currentCameraId ? ' active' : ''}${editMode ? ' editable' : ''}`}
          style={{ left: `${cam.x}%`, top: `${cam.y}%` }}
          onPointerDown={(e) => handlePointerDown(e, cam.id)}
          title={cam.name}
        >
          <CameraGlyph />
          <span className="floorplan-pin-label">{cam.name}</span>
        </button>
      ))}
    </div>
  );
}
