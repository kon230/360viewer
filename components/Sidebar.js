'use client';

export default function Sidebar({
  plans,
  currentPlan,
  onPlanChange,
  cameras,
  currentCameraId,
  onSelectCamera,
  onRenameCamera,
  onAddCamera,
  onDeleteCamera,
  editMode,
  onToggleEditMode,
}) {
  return (
    <div className="sidebar-panel">
      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>インテリア案</span>
          <button
            type="button"
            className={`edit-toggle${editMode ? ' active' : ''}`}
            onClick={onToggleEditMode}
          >
            {editMode ? '編集モード: ON' : '編集モード'}
          </button>
        </div>
        <div className="plan-switch">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`plan-btn${p.id === currentPlan ? ' active' : ''}`}
              onClick={() => onPlanChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-section camera-list-section">
        <div className="sidebar-heading">
          <span>カメラ</span>
        </div>
        <ul className="camera-list">
          {cameras.map((cam) => (
            <li key={cam.id} className={cam.id === currentCameraId ? 'active' : ''}>
              {editMode ? (
                <>
                  <input
                    className="camera-name-input"
                    value={cam.name}
                    onChange={(e) => onRenameCamera(cam.id, e.target.value)}
                    onFocus={() => onSelectCamera(cam.id)}
                  />
                  <button
                    type="button"
                    className="camera-delete-btn"
                    onClick={() => onDeleteCamera(cam.id)}
                    disabled={cameras.length <= 1}
                    title="このカメラを削除"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </>
              ) : (
                <button type="button" className="camera-select-btn" onClick={() => onSelectCamera(cam.id)}>
                  {cam.name}
                </button>
              )}
            </li>
          ))}
        </ul>
        {editMode && (
          <button type="button" className="camera-add-btn" onClick={onAddCamera}>
            + カメラを追加
          </button>
        )}
      </div>
    </div>
  );
}
