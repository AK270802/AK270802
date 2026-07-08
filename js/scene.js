/* ============================================================
   LATENT SPACE — persistent particle/node field
   - deferred init (requestIdleCallback) so hero text paints first
   - node counts scale down on mobile / low-core devices
   - loop pauses when the tab is hidden
   - prefers-reduced-motion → single static frame, no loop
   - WebGL/CDN failure → canvas removed, CSS background remains
   - colors read from CSS custom properties, re-read on theme change
   ============================================================ */

const canvas = document.getElementById("scene");

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const LOW_POWER =
  window.matchMedia("(max-width: 768px)").matches ||
  (navigator.hardwareConcurrency || 8) <= 4;

// home hero runs a denser, closer field
const DENSE = document.body.dataset.scene === "dense";
const COUNT = DENSE ? (LOW_POWER ? 70 : 170) : (LOW_POWER ? 45 : 110);
const LINK_DIST = DENSE ? 2.6 : 2.3;
const BOUNDS = { x: 11, y: 7, z: 5 };

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function boot() {
  if (!canvas) return;

  let THREE;
  try {
    THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js"
    );
  } catch {
    canvas.remove();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
  } catch {
    canvas.remove();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = DENSE ? 7.5 : 9;

  // -- nodes --------------------------------------------------
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2 * BOUNDS.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * BOUNDS.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * BOUNDS.z;
    velocities[i * 3] = (Math.random() - 0.5) * 0.004;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.004;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  }

  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointMat = new THREE.PointsMaterial({
    size: DENSE ? 0.055 : 0.045,
    transparent: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(pointGeo, pointMat));

  // -- links: preallocated segment buffer, refilled per frame -
  const MAX_LINKS = COUNT * 5;
  const linkPositions = new Float32Array(MAX_LINKS * 6);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(linkPositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  const linkMat = new THREE.LineBasicMaterial({
    transparent: true,
    depthWrite: false,
  });
  scene.add(new THREE.LineSegments(linkGeo, linkMat));

  function applyThemeColors() {
    pointMat.color.set(cssColor("--particle-color"));
    pointMat.opacity = parseFloat(cssColor("--particle-opacity")) || 0.7;
    const link = cssColor("--particle-link");
    // --particle-link is rgba(); split color and alpha for the material
    const m = link.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b, a] = m[1].split(",").map((v) => parseFloat(v));
      linkMat.color.setRGB(r / 255, g / 255, b / 255);
      linkMat.opacity = isNaN(a) ? 0.25 : a;
    } else {
      linkMat.color.set(link);
      linkMat.opacity = 0.25;
    }
  }
  applyThemeColors();
  document.addEventListener("themechange", applyThemeColors);

  // -- gentle pointer / scroll parallax -----------------------
  const target = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.9;
      target.y = (e.clientY / window.innerHeight - 0.5) * 0.6;
    },
    { passive: true }
  );

  function step() {
    for (let i = 0; i < COUNT; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const idx = i * 3 + axis;
        positions[idx] += velocities[idx];
        const bound = axis === 0 ? BOUNDS.x : axis === 1 ? BOUNDS.y : BOUNDS.z;
        if (positions[idx] > bound || positions[idx] < -bound) {
          velocities[idx] *= -1;
        }
      }
    }
    pointGeo.attributes.position.needsUpdate = true;

    let links = 0;
    const limit = LINK_DIST * LINK_DIST;
    for (let i = 0; i < COUNT && links < MAX_LINKS; i++) {
      for (let j = i + 1; j < COUNT && links < MAX_LINKS; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < limit) {
          const o = links * 6;
          linkPositions[o] = positions[i * 3];
          linkPositions[o + 1] = positions[i * 3 + 1];
          linkPositions[o + 2] = positions[i * 3 + 2];
          linkPositions[o + 3] = positions[j * 3];
          linkPositions[o + 4] = positions[j * 3 + 1];
          linkPositions[o + 5] = positions[j * 3 + 2];
          links++;
        }
      }
    }
    linkGeo.setDrawRange(0, links * 2);
    linkGeo.attributes.position.needsUpdate = true;

    // slow cinematic drift + pointer parallax + scroll depth
    camera.position.x += (target.x - camera.position.x) * 0.03;
    camera.position.y += (-target.y - camera.position.y) * 0.03;
    camera.position.z =
      (DENSE ? 7.5 : 9) + Math.min(window.scrollY * 0.0012, 1.6);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (REDUCED) step();
  });

  if (REDUCED) {
    // single composed frame, no animation loop
    step();
    return;
  }

  let running = true;
  function loop() {
    if (!running) return;
    step();
    requestAnimationFrame(loop);
  }

  document.addEventListener("visibilitychange", () => {
    const visible = document.visibilityState === "visible";
    if (visible && !running) {
      running = true;
      loop();
    } else if (!visible) {
      running = false;
    }
  });

  document.addEventListener("themechange", () => {
    if (REDUCED) step();
  });

  loop();
}

// defer init so critical text paints first (LCP protection)
if ("requestIdleCallback" in window) {
  requestIdleCallback(boot, { timeout: 1500 });
} else {
  setTimeout(boot, 350);
}
