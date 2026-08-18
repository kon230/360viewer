// Framework-agnostic WebGL equirectangular panorama engine.
// No external dependencies. Used by the PanoramaViewer React component.

function m4perspective(fovyRad, aspect, near, far) {
  const f = 1 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function m4lookAtDir(dir, up) {
  const z = norm([-dir[0], -dir[1], -dir[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    0, 0, 0, 1,
  ]);
}

function m4mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [cp * Math.sin(yaw), Math.sin(pitch), -cp * Math.cos(yaw)];
}

export function yawPitchFromDir(d) {
  const dn = norm(d);
  const pitch = Math.asin(Math.max(-1, Math.min(1, dn[1])));
  const yaw = Math.atan2(dn[0], -dn[2]);
  return [yaw, pitch];
}

function buildSphere(latSeg, lonSeg, radius) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let lat = 0; lat <= latSeg; lat++) {
    const theta = (lat * Math.PI) / latSeg;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lon = 0; lon <= lonSeg; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSeg;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      positions.push(radius * sinT * cosP, radius * cosT, radius * sinT * sinP);
      uvs.push(lon / lonSeg, lat / latSeg);
    }
  }
  for (let lat = 0; lat < latSeg; lat++) {
    for (let lon = 0; lon < lonSeg; lon++) {
      const a = lat * (lonSeg + 1) + lon;
      const b = a + lonSeg + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

const VS = `
attribute vec3 aPos;
attribute vec2 aUv;
uniform mat4 uView;
uniform mat4 uProj;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`;

const FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  gl_FragColor = texture2D(uTex, vUv);
}`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('Shader compile error: ' + info);
  }
  return s;
}

// Draws a simple placeholder equirectangular texture with a label, used
// while a real panorama image hasn't been assigned to a camera/plan yet.
export function makePlaceholderDataUrl(label, hue) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, `hsl(${hue}, 45%, 55%)`);
  sky.addColorStop(1, `hsl(${hue}, 35%, 82%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 256);
  const floor = ctx.createLinearGradient(0, 256, 0, 512);
  floor.addColorStop(0, '#b9a583');
  floor.addColorStop(1, '#6f6047');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 256, 1024, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 16; i++) {
    const x = (i * 1024) / 16;
    ctx.beginPath();
    ctx.moveTo(x, 150);
    ctx.lineTo(x, 362);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(1024 / 2 - 220, 226, 440, 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 1024 / 2, 266);
  return c.toDataURL('image/jpeg', 0.85);
}

export class PanoramaEngine {
  constructor(canvas, overlayEl) {
    this.canvas = canvas;
    this.overlayEl = overlayEl;
    this.gl = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('WebGL is not supported in this browser');
    this._initGl();
    // -PI/2 faces the horizontal center of the source equirectangular image
    // (see buildSphere's phi->yaw mapping), so a freshly loaded panorama
    // opens facing the "front" of the photo rather than an arbitrary edge.
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.fov = 75;
    this.minFov = 30;
    this.maxFov = 100;
    this.markers = [];
    this.markerEls = new Map();
    this.editMode = false;
    this.callbacks = {};
    this.placingMode = false;
    this._dragging = false;
    this._draggedMarkerId = null;
    this._pendingMoved = false;
    this._boundResize = () => this._resize();
    this._ro = new ResizeObserver(this._boundResize);
    this._ro.observe(canvas);
    this._resize();
    this._attachInputHandlers();
    this._raf = requestAnimationFrame(() => this._frame());
  }

  _initGl() {
    const gl = this.gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    this.prog = prog;

    const sph = buildSphere(32, 48, 50);
    this.indexCount = sph.indices.length;

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sph.positions, gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sph.uvs, gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sph.indices, gl.STATIC_DRAW);

    this.aPos = gl.getAttribLocation(prog, 'aPos');
    this.aUv = gl.getAttribLocation(prog, 'aUv');
    this.uView = gl.getUniformLocation(prog, 'uView');
    this.uProj = gl.getUniformLocation(prog, 'uProj');
    this.uTex = gl.getUniformLocation(prog, 'uTex');
    this.posBuf = posBuf;
    this.uvBuf = uvBuf;
    this.idxBuf = idxBuf;

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 40, 40, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  on(event, cb) {
    this.callbacks[event] = cb;
  }

  setEditMode(v) {
    this.editMode = v;
    if (!v) this.placingMode = false;
  }

  setPlacingMode(v) {
    this.placingMode = v;
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  setMarkers(markers) {
    this.markers = markers || [];
    const seen = new Set();
    for (const m of this.markers) {
      seen.add(m.id);
      let el = this.markerEls.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'pano-marker';
        const icon = document.createElement('span');
        icon.className = 'pano-marker-icon';
        el.appendChild(icon);
        this.overlayEl.appendChild(el);
        this.markerEls.set(m.id, el);
        this._attachMarkerHandlers(el, m.id);
      }
      // Only the dedicated icon child is rewritten here, never el itself:
      // callers (e.g. React portals) may attach extra children (a popover)
      // directly to el, and those must survive repeated setMarkers() calls.
      el.dataset.kind = m.kind || 'nav';
      const icon = el.querySelector('.pano-marker-icon');
      icon.innerHTML = m.kind === 'info'
        ? `<span class="pano-marker-dot"></span>`
        : `<span class="pano-marker-arrow">&#9650;</span>`;
      if (m.label) el.title = m.label;
      el.classList.toggle('edit-mode', this.editMode);
    }
    for (const [id, el] of this.markerEls) {
      if (!seen.has(id)) {
        el.remove();
        this.markerEls.delete(id);
      }
    }
  }

  _attachMarkerHandlers(el, id) {
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._draggedMarkerId = id;
      this._pendingMoved = false;
      this._downX = e.clientX;
      this._downY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointerup', (e) => {
      if (this._draggedMarkerId === id && !this._pendingMoved) {
        if (this.callbacks.markerClick) this.callbacks.markerClick(id);
      }
      this._draggedMarkerId = null;
    });
  }

  _attachInputHandlers() {
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
      if (this.placingMode) {
        const yp = this._screenToYawPitch(e);
        if (this.callbacks.placeMarker) this.callbacks.placeMarker(yp[0], yp[1]);
        return;
      }
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', (e) => {
      if (this._draggedMarkerId) {
        const dx = e.clientX - this._downX;
        const dy = e.clientY - this._downY;
        if (Math.hypot(dx, dy) > 3) this._pendingMoved = true;
        const yp = this._screenToYawPitch(e);
        if (this.callbacks.markerDrag) this.callbacks.markerDrag(this._draggedMarkerId, yp[0], yp[1]);
        return;
      }
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      const scale = (this.fov / 75) * 0.0025;
      this.yaw -= dx * scale;
      this.pitch += dy * scale;
      const lim = (Math.PI / 2) * 0.98;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
    window.addEventListener('pointerup', () => {
      this._dragging = false;
      canvas.style.cursor = 'grab';
      this._draggedMarkerId = null;
    });
    canvas.addEventListener('wheel', (e) => {
      this.fov = Math.max(this.minFov, Math.min(this.maxFov, this.fov + e.deltaY * 0.05));
      e.preventDefault();
    }, { passive: false });
  }

  _screenToYawPitch(e) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const tanF = Math.tan(((this.fov * Math.PI) / 180) / 2);
    const aspect = this.canvas.width / this.canvas.height;
    const vx = ndcX * tanF * aspect;
    const vy = ndcY * tanF;
    const vz = -1;
    const dir = dirFromYawPitch(this.yaw, this.pitch);
    const up = [0, 1, 0];
    const zAxis = norm([-dir[0], -dir[1], -dir[2]]);
    const xAxis = norm(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);
    const world = [
      xAxis[0] * vx + yAxis[0] * vy + zAxis[0] * vz,
      xAxis[1] * vx + yAxis[1] * vy + zAxis[1] * vz,
      xAxis[2] * vx + yAxis[2] * vy + zAxis[2] * vz,
    ];
    return yawPitchFromDir(world);
  }

  _frame() {
    this._resize();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.05, 0.05, 0.06, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const dir = dirFromYawPitch(this.yaw, this.pitch);
    const view = m4lookAtDir(dir, [0, 1, 0]);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const proj = m4perspective((this.fov * Math.PI) / 180, aspect, 0.1, 200);

    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.uTex, 0);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    const vp = m4mul(proj, view);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const m of this.markers) {
      const el = this.markerEls.get(m.id);
      if (!el) continue;
      const mdir = dirFromYawPitch(m.yaw, m.pitch);
      const clip = [
        vp[0] * mdir[0] + vp[4] * mdir[1] + vp[8] * mdir[2] + vp[12],
        vp[1] * mdir[0] + vp[5] * mdir[1] + vp[9] * mdir[2] + vp[13],
        vp[2] * mdir[0] + vp[6] * mdir[1] + vp[10] * mdir[2] + vp[14],
        vp[3] * mdir[0] + vp[7] * mdir[1] + vp[11] * mdir[2] + vp[15],
      ];
      if (clip[3] > 0.001) {
        const ndcX = clip[0] / clip[3];
        const ndcY = clip[1] / clip[3];
        const sx = (ndcX * 0.5 + 0.5) * w;
        const sy = (1 - (ndcY * 0.5 + 0.5)) * h;
        el.style.display = '';
        el.style.transform = `translate(${sx}px, ${sy}px)`;
      } else {
        el.style.display = 'none';
      }
    }

    if (this.callbacks.viewChange) {
      this.callbacks.viewChange({ yaw: this.yaw, pitch: this.pitch, fov: this.fov });
    }

    this._raf = requestAnimationFrame(() => this._frame());
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    for (const [, el] of this.markerEls) el.remove();
    this.markerEls.clear();
  }
}
