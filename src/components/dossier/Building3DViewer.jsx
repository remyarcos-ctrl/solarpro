import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { ShapeUtils } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ── GPS → Three.js local metric coords ───────────────────────────────────────
// Convention : X = Est, Y = Hauteur, Z = -Sud  (Three.js Y-up)
function makeLocal(cLon, cLat, zRef) {
  const mLon = 111320 * Math.cos((cLat * Math.PI) / 180);
  const mLat = 111320;
  return (lon, lat, absZ) =>
    new THREE.Vector3(
      (lon - cLon) * mLon,
      (absZ ?? zRef) - zRef,
      -((lat - cLat) * mLat)
    );
}

// ── Triangulation d'un polygone plat (XZ) avec hauteurs variables ─────────────
function roofGeometry(localRing, hasLOD2, fallbackY) {
  const pts2d  = localRing.map(v => new THREE.Vector2(v.x, v.z));
  const tris   = ShapeUtils.triangulateShape(pts2d, []);
  const pos    = new Float32Array(tris.length * 3 * 3);
  let o = 0;
  for (const [a, b, c] of tris)
    for (const i of [a, b, c]) {
      const v = localRing[i];
      pos[o++] = v.x;
      pos[o++] = hasLOD2 ? v.y : fallbackY;
      pos[o++] = v.z;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ── Quads de murs (sol → sommet de toit par vertex) ──────────────────────────
function wallGeometry(localRing) {
  const n   = localRing.length;
  const pos = new Float32Array(n * 2 * 3 * 3); // n quads × 2 tris × 3 verts × 3 coords
  let o = 0;
  for (let i = 0; i < n; i++) {
    const a = localRing[i], b = localRing[(i + 1) % n];
    const q = [
      new THREE.Vector3(a.x, 0,   a.z),
      new THREE.Vector3(b.x, 0,   b.z),
      new THREE.Vector3(b.x, b.y, b.z),
      new THREE.Vector3(a.x, a.y, a.z),
    ];
    for (const [i0, i1, i2] of [[0,1,2],[0,2,3]])
      for (const j of [i0, i1, i2]) { pos[o++]=q[j].x; pos[o++]=q[j].y; pos[o++]=q[j].z; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export default function Building3DViewer({ building, panelFeatures }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!building || !mount) return;

    // ── 1. Prépare le ring 3D ────────────────────────────────────────────────
    const raw = building.footprint3d?.[0] ?? building.footprint?.[0];
    if (!raw?.length) return;
    // Supprime le point de fermeture doublon
    const ring = (raw[0][0] === raw[raw.length-1][0] && raw[0][1] === raw[raw.length-1][1])
      ? raw.slice(0, -1) : raw;

    const cLon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const zRef = building.altSol ?? 0;
    const hauteur = building.hauteur ?? 6;
    const altToit  = building.altToit ?? (zRef + hauteur);
    const toLocal  = makeLocal(cLon, cLat, zRef);

    const localRing = ring.map(([lon, lat, z]) => {
      const safeZ = (z != null && z > -900) ? z : zRef + hauteur;
      return toLocal(lon, lat, safeZ);
    });

    const ys = localRing.map(v => v.y);
    const hasLOD2 = Math.max(...ys) - Math.min(...ys) > 0.3;
    const radius  = Math.max(...localRing.map(v => Math.hypot(v.x, v.z)));

    // ── 2. Three.js setup ────────────────────────────────────────────────────
    const W = mount.clientWidth || 800;
    const H = mount.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled  = true;
    renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c18);
    scene.fog = new THREE.FogExp2(0x060c18, 0.008);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    const camDist = Math.max(radius * 3.5, 20);
    camera.position.set(camDist * 0.55, camDist * 0.6, camDist * 0.75);
    camera.lookAt(0, hauteur * 0.5, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.07;
    controls.target.set(0, hauteur * 0.4, 0);
    controls.minDistance    = 3;
    controls.maxDistance    = camDist * 4;
    controls.maxPolarAngle  = Math.PI / 2.05;

    // ── 3. Lumières ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x8899cc, 0.65));
    scene.add(new THREE.HemisphereLight(0x334466, 0x0a1020, 0.4));
    const sun = new THREE.DirectionalLight(0xfff0cc, 1.6);
    sun.position.set(18, 35, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = Math.max(radius * 1.5, 20);
    Object.assign(sun.shadow.camera, { left:-sc, right:sc, top:sc, bottom:-sc, near:0.5, far:200 });
    scene.add(sun);

    // ── 4. Sol ───────────────────────────────────────────────────────────────
    const gnd = new THREE.Mesh(
      new THREE.CircleGeometry(camDist * 1.2, 48),
      new THREE.MeshLambertMaterial({ color: 0x0d1925 })
    );
    gnd.rotation.x = -Math.PI / 2;
    gnd.receiveShadow = true;
    scene.add(gnd);

    // ── 5. Murs ──────────────────────────────────────────────────────────────
    const wMesh = new THREE.Mesh(
      wallGeometry(localRing),
      new THREE.MeshLambertMaterial({ color: 0x1a2e46 })
    );
    wMesh.castShadow = wMesh.receiveShadow = true;
    scene.add(wMesh);

    // ── 6. Toit ──────────────────────────────────────────────────────────────
    const rGeom = roofGeometry(localRing, hasLOD2, hauteur);
    const rMesh = new THREE.Mesh(
      rGeom,
      new THREE.MeshLambertMaterial({ color: 0x243855, side: THREE.DoubleSide })
    );
    rMesh.castShadow = true;
    scene.add(rMesh);
    // Wireframe subtil
    scene.add(new THREE.LineSegments(
      new THREE.WireframeGeometry(rGeom),
      new THREE.LineBasicMaterial({ color: 0x2a4060, transparent: true, opacity: 0.45 })
    ));

    // ── 7. Panneaux solaires ─────────────────────────────────────────────────
    const panelY = (altToit - zRef) + 0.12; // 12 cm au-dessus du toit
    const fillPos = [], linePos = [];

    for (const feat of (panelFeatures ?? [])) {
      const corners = feat.geometry.coordinates[0].slice(0, 4);
      const lc = corners.map(([lon, lat]) => {
        const v = toLocal(lon, lat, zRef + panelY);
        // Forcer Y au niveau du toit (les coins n'ont pas de Z IGN)
        v.y = panelY;
        return v;
      });
      for (const [i0, i1, i2] of [[0,1,2],[0,2,3]])
        for (const j of [i0, i1, i2])
          fillPos.push(lc[j].x, lc[j].y, lc[j].z);
      for (let k = 0; k < 4; k++) {
        const a = lc[k], b = lc[(k+1)%4];
        linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }

    if (fillPos.length > 0) {
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.Float32BufferAttribute(fillPos, 3));
      pg.computeVertexNormals();
      scene.add(new THREE.Mesh(pg, new THREE.MeshLambertMaterial({
        color: 0x0a1e36, emissive: 0x1a4080, emissiveIntensity: 0.55, side: THREE.DoubleSide,
      })));
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
      scene.add(new THREE.LineSegments(lg,
        new THREE.LineBasicMaterial({ color: 0x3b82f6 })
      ));
    }

    // ── 8. Flèche Nord (rouge, pointe vers -Z = Nord) ────────────────────────
    scene.add(new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.1, 0),
      Math.max(radius * 0.5, 2.5),
      0xef4444, 0.8, 0.45
    ));

    // ── 9. Boucle de rendu ───────────────────────────────────────────────────
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      const w = mount.clientWidth || 800, h = mount.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [building, panelFeatures]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: 480, background: "#060c18", borderRadius: 12, overflow: "hidden" }}
    />
  );
}
