'use client';

import { useCallback } from 'react';
import { useViewer } from '@/lib/store';
import FloorPlan from '@/components/FloorPlan';
import Sidebar from '@/components/Sidebar';
import PanoramaViewer from '@/components/PanoramaViewer';

export default function Page() {
  const {
    plans,
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
  } = useViewer();

  const otherCameras = cameras.filter((c) => c.id !== currentCameraId);
  const planLabel = plans.find((p) => p.id === currentPlan)?.label || currentPlan;

  const handleAddMarker = useCallback(
    (yaw, pitch) => {
      const defaultTarget = otherCameras[0]?.id;
      if (!defaultTarget) return;
      addMarker(currentCameraId, defaultTarget, yaw, pitch);
    },
    [addMarker, currentCameraId, otherCameras]
  );

  const handleMarkerDrag = useCallback(
    (markerId, yaw, pitch) => {
      updateMarker(currentCameraId, markerId, yaw, pitch);
    },
    [updateMarker, currentCameraId]
  );

  return (
    <div className="app-shell">
      <div className="left-column">
        <div className="floorplan-pane">
          <FloorPlan
            cameras={cameras}
            currentCameraId={currentCameraId}
            editMode={editMode}
            onSelect={setCurrentCameraId}
            onMove={updateCameraPosition}
          />
        </div>
        <Sidebar
          plans={plans}
          currentPlan={currentPlan}
          onPlanChange={setCurrentPlan}
          cameras={cameras}
          currentCameraId={currentCameraId}
          onSelectCamera={setCurrentCameraId}
          onRenameCamera={renameCamera}
          onAddCamera={addCamera}
          onDeleteCamera={deleteCamera}
          editMode={editMode}
          onToggleEditMode={() => setEditMode((v) => !v)}
        />
      </div>

      <div className="right-pane">
        <div className="pano-header">
          <span className="pano-header-camera">{currentCamera.name}</span>
          <span className="pano-header-plan">{planLabel}</span>
        </div>
        <PanoramaViewer
          imageUrl={currentCamera.images[currentPlan]}
          placeholderLabel={`${currentCamera.name}（${planLabel}）`}
          markers={currentCamera.markers}
          otherCameras={otherCameras}
          editMode={editMode}
          onNavigate={setCurrentCameraId}
          onMarkerDrag={handleMarkerDrag}
          onMarkerDelete={(markerId) => deleteMarker(currentCameraId, markerId)}
          onMarkerTargetChange={(markerId, targetId) => updateMarkerTarget(currentCameraId, markerId, targetId)}
          onAddMarker={handleAddMarker}
        />
      </div>
    </div>
  );
}
