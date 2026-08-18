// Default content for the 360 viewer.
// Images live in /public/images so they are served statically (works out of
// the box on Vercel). Replace the files there (keeping the same names, or
// updating the paths below) to swap in new renders.

export const PLANS = [
  { id: 'A', label: 'A案' },
  { id: 'B', label: 'B案' },
  { id: 'C', label: 'C案' },
];

export const DEFAULT_CAMERAS = [
  {
    id: 'cam1',
    name: 'カメラ1',
    x: 34,
    y: 55,
    images: {
      A: '/images/panoramas/cam-corridor-a.jpg',
      B: '/images/panoramas/cam-corridor-b.jpg',
      C: null,
    },
    markers: [
      { id: 'cam1-m1', targetId: 'cam2', yaw: 3.2, pitch: -0.55 },
    ],
  },
  {
    id: 'cam2',
    name: 'カメラ2',
    x: 40,
    y: 24,
    images: {
      A: '/images/panoramas/cam-lounge-a.jpg',
      B: '/images/panoramas/cam-lounge-b.jpg',
      C: null,
    },
    markers: [
      { id: 'cam2-m1', targetId: 'cam1', yaw: -0.13, pitch: -0.5 },
    ],
  },
];

export const FLOORPLAN_IMAGE = '/images/floorplans/floorplan.webp';
