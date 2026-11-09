"use client";

/**
 * Think Leo — the THREE.JS surprise egg
 * ─────────────────────────────────────
 * The star of LEO EGGS: a real 3D candy egg the kid can spin with a
 * finger, that wobbles harder the longer it is pressed, grows dark
 * fissures, leaks golden light when it TEASES a rare hatch — then
 * bursts into two shell halves and a fountain of round glow sparks.
 *
 * Why three.js here (and not DOM): the egg must feel like an object,
 * not a button. Perspective, inertia and a light-drenched burst are
 * what make the 2-second hold worth repeating a hundred times.
 *
 * Phone budget: one canvas, ≤4 meshes + burst pools, DPR capped at 2,
 * textures are tiny generated canvases, everything is disposed on
 * unmount, and the render loop is the ONLY animation source (no CSS
 * fight). Props drive it from React; the loop reads refs, so a hold
 * never re-renders the tree.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { EggKind } from "@/lib/eggs";
import { EGG_KINDS } from "@/lib/eggs";

export interface Egg3DProps {
  kind: EggKind;
  /** fissure visibility, 0..1 (driven by the hold progress) */
  crack: number;
  /** true while the kid is pressing — shakes the egg */
  holding: boolean;
  /** golden tease glow (near-miss engine) */
  tease: boolean;
  /** increment to fire the shell burst (0 = never burst) */
  burstKey: number;
  className?: string;
}

/* ── tiny generated textures (no asset downloads, ever) ────────── */

function makeShellTexture(top: string, bottom: string, spots: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // candy speckles — drawn three times (x, x±256) so the sphere seam is clean
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256;
    const y = 36 + Math.random() * 176;
    const r = 2 + Math.random() * 3.4;
    g.globalAlpha = 0.34 + Math.random() * 0.3;
    g.fillStyle = spots;
    for (const xx of [x - 256, x, x + 256]) {
      g.beginPath();
      g.ellipse(xx, y, r, r * 0.72, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Jagged dark fissures radiating from the crown — alpha lines only. */
function makeCrackTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "#4A2F1B";
  g.lineCap = "round";
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let line = 0; line < 8; line++) {
    const ang = -Math.PI / 2 + (line - 3.5) * 0.42 + (rnd() - 0.5) * 0.2;
    let x = 128;
    let y = 58;
    g.lineWidth = 3.4;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 5 + Math.floor(rnd() * 3);
    for (let s = 0; s < steps; s++) {
      const len = 16 + rnd() * 22;
      const a = ang + (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len * 0.9;
      g.lineTo(x, y);
      if (rnd() < 0.5) {
        const bl = 8 + rnd() * 12;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a + 1.2) * bl, y + Math.sin(a + 1.2) * bl);
        g.moveTo(x, y);
      }
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Round, soft-edged glow disc — particles and light use THIS, never squares. */
function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,225,150,0.85)");
  grad.addColorStop(1, "rgba(255,209,102,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, "rgba(74,47,27,0.42)");
  grad.addColorStop(1, "rgba(74,47,27,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ── the component ─────────────────────────────────────────────── */

interface BurstPiece {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  born: number;
}

interface SparkPool {
  pts: THREE.Points;
  vels: Float32Array;
  born: number;
}

export function Egg3D({ kind, crack, holding, tease, burstKey, className = "" }: Egg3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  /* live values for the render loop — refs so props never re-trigger setup.
     Synced in an effect (never during render) per the React refs contract;
     effects run before the loop's next frame, so the egg reacts instantly. */
  const live = useRef({ crack, holding, tease, kind });
  useEffect(() => {
    live.current = { crack, holding, tease, kind };
  });
  const burstRef = useRef(0);
  const apiRef = useRef<{ fire: () => void; setKind: (k: EggKind) => void } | null>(null);

  /* fire the shell burst when the parent raises burstKey */
  useEffect(() => {
    if (burstKey > 0 && burstRef.current !== burstKey) {
      burstRef.current = burstKey;
      apiRef.current?.fire();
    }
  }, [burstKey]);

  /* live palette swap when the egg kind changes */
  useEffect(() => {
    apiRef.current?.setKind(kind);
  }, [kind]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    camera.position.set(0, 0.18, 4.35);
    camera.lookAt(0, 0, 0);

    /* lights — warm key, cool rim, and the light INSIDE the egg */
    const hemi = new THREE.HemisphereLight(0xfff6e6, 0xe0b97f, 1.15);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-2.2, 3.2, 3.4);
    scene.add(key);
    const rim = new THREE.PointLight(0x9b5de5, 14, 12);
    rim.position.set(2.6, -1.4, -2.4);
    scene.add(rim);
    const inner = new THREE.PointLight(0xffd75e, 0, 6);
    inner.position.set(0, 0.15, 0);
    scene.add(inner);

    /* the egg */
    const eggGeo = new THREE.SphereGeometry(1, 48, 64);
    const shellMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.04 });
    const egg = new THREE.Mesh(eggGeo, shellMat);
    egg.scale.set(1, 1.28, 0.94);
    scene.add(egg);

    /* fissure overlay (slightly larger, transparent) */
    const crackMat = new THREE.MeshBasicMaterial({
      map: makeCrackTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const crackMesh = new THREE.Mesh(eggGeo.clone(), crackMat);
    crackMesh.scale.set(1.014, 1.296, 0.954);
    scene.add(crackMesh);

    /* golden tease glow behind the egg */
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0xffd75e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.set(3.6, 3.6, 1);
    glow.position.set(0, 0.1, -0.9);
    scene.add(glow);

    /* soft ground shadow */
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.62;
    scene.add(shadow);

    /* burst pools */
    const bursts: BurstPiece[] = [];
    const sparks: SparkPool[] = [];

    const applyKind = (k: EggKind) => {
      const meta = EGG_KINDS[k];
      const old = shellMat.map;
      shellMat.map = makeShellTexture(meta.shell[0], meta.shell[1], meta.spots);
      shellMat.needsUpdate = true;
      old?.dispose();
    };
    applyKind(live.current.kind);

    const fire = () => {
      const now = performance.now();
      flashUntil = now + 460;
      egg.visible = false;
      crackMesh.visible = false;
      glow.scale.set(5.4, 5.4, 1);
      inner.intensity = 60;

      // two shell halves fly apart
      const halves = [
        new THREE.SphereGeometry(1, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.SphereGeometry(1, 32, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      ];
      halves.forEach((geo, i) => {
        const mat = new THREE.MeshStandardMaterial({
          map: shellMat.map,
          roughness: 0.4,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const half = new THREE.Mesh(geo, mat);
        half.scale.set(1, 1.28, 0.94);
        half.position.y = i === 0 ? 0.04 : -0.04;
        scene.add(half);
        bursts.push({
          mesh: half,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 2.6,
            i === 0 ? 3.4 + Math.random() : -1.2 - Math.random(),
            (Math.random() - 0.5) * 1.4
          ),
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6
          ),
          born: now,
        });
      });

      // a fountain of round glow sparks (never square points)
      const N = 90;
      const pos = new Float32Array(N * 3);
      const vels = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = 0;
        pos[i * 3 + 1] = 0.1;
        pos[i * 3 + 2] = 0;
        const a = Math.random() * Math.PI * 2;
        const up = 1.6 + Math.random() * 3.6;
        const sp = 1.2 + Math.random() * 2.6;
        vels[i * 3] = Math.cos(a) * sp;
        vels[i * 3 + 1] = up;
        vels[i * 3 + 2] = Math.sin(a) * sp * 0.6;
      }
      const pgeo = new THREE.BufferGeometry();
      pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pmat = new THREE.PointsMaterial({
        map: makeGlowTexture(),
        color: 0xffe49a,
        size: 0.16,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const pts = new THREE.Points(pgeo, pmat);
      scene.add(pts);
      sparks.push({ pts, vels, born: now });
    };
    apiRef.current = { fire, setKind: applyKind };

    /* drag-to-spin (with inertia) — the egg is an object, not a button */
    let dragging = false;
    let lastX = 0;
    let spinV = 0;
    let rotY = 0.5;
    let flashUntil = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spinV = dx * 0.012;
      rotY += spinV;
    };
    const onUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    /* resize */
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* the loop */
    let raf = 0;
    let visCrack = 0;
    let glowCur = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      const st = live.current;

      // crack visibility eases toward the target (smooth fissure growth)
      visCrack += (st.crack - visCrack) * Math.min(1, dt * 9);
      crackMat.opacity = visCrack;

      // shake: idle breathing → hold rumble → near-burst frenzy
      const amp = st.holding ? 0.05 + visCrack * 0.16 : 0.018;
      const freq = st.holding ? 24 + visCrack * 22 : 1.6;
      egg.rotation.z = Math.sin(t * freq) * amp;
      egg.rotation.x = Math.cos(t * freq * 0.83) * amp * 0.6;
      crackMesh.rotation.z = egg.rotation.z;
      crackMesh.rotation.x = egg.rotation.x;
      egg.position.y = Math.sin(t * 1.4) * 0.045 + (st.holding ? Math.sin(t * 30) * 0.02 : 0);
      crackMesh.position.y = egg.position.y;

      // idle auto-spin + drag inertia
      if (!dragging) {
        spinV *= 0.94;
        rotY += spinV + (st.holding ? dt * 2.2 : dt * 0.25); // the hold spins it faster — it is waking up
      }
      egg.rotation.y = rotY;
      crackMesh.rotation.y = rotY;

      // golden tease: honest-but-noisy near-miss glow + burst flash
      const wantGlow = st.tease ? 0.9 : 0;
      glowCur += (wantGlow - glowCur) * Math.min(1, dt * 6);
      const flash = Math.max(0, 1 - (performance.now() - (flashUntil - 460)) / 460);
      glow.material.opacity = Math.max(glowCur, flash);
      glow.scale.setScalar(3.6 + glowCur * 0.5 + Math.sin(t * 7) * 0.12 * glowCur);
      inner.intensity = Math.max(inner.intensity * (1 - dt * 2.4), glowCur * 26);

      // shell halves fly + fade
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        const age = (performance.now() - b.born) / 1000;
        b.vel.y -= 7.5 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += b.spin.x * dt;
        b.mesh.rotation.y += b.spin.y * dt;
        b.mesh.rotation.z += b.spin.z * dt;
        const m = b.mesh.material as THREE.MeshStandardMaterial;
        if (age > 0.55) m.opacity = Math.max(0, 1 - (age - 0.55) / 0.75);
        if (age > 1.35) {
          scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          m.dispose();
          bursts.splice(i, 1);
        }
      }

      // sparks shower + fade
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        const age = (performance.now() - p.born) / 1000;
        const arr = p.pts.geometry.attributes.position.array as Float32Array;
        for (let j = 0; j < arr.length / 3; j++) {
          p.vels[j * 3 + 1] -= 4.6 * dt;
          arr[j * 3] += p.vels[j * 3] * dt;
          arr[j * 3 + 1] += p.vels[j * 3 + 1] * dt;
          arr[j * 3 + 2] += p.vels[j * 3 + 2] * dt;
        }
        p.pts.geometry.attributes.position.needsUpdate = true;
        (p.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - age / 1.25);
        if (age > 1.3) {
          scene.remove(p.pts);
          p.pts.geometry.dispose();
          const pm = p.pts.material as THREE.PointsMaterial;
          pm.map?.dispose();
          pm.dispose();
          sparks.splice(i, 1);
        }
      }

      // rebirth: once the burst is over, the egg quietly returns
      if (!egg.visible && bursts.length === 0 && sparks.length === 0) {
        egg.visible = true;
        crackMesh.visible = true;
        visCrack = 0;
      }

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      bursts.forEach((b) => {
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.MeshStandardMaterial).dispose();
      });
      sparks.forEach((p) => {
        p.pts.geometry.dispose();
        const pm = p.pts.material as THREE.PointsMaterial;
        pm.map?.dispose();
        pm.dispose();
      });
      eggGeo.dispose();
      crackMesh.geometry.dispose();
      shellMat.map?.dispose();
      shellMat.dispose();
      crackMat.map?.dispose();
      crackMat.dispose();
      glow.material.map?.dispose();
      glow.material.dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.MeshBasicMaterial).map?.dispose();
      (shadow.material as THREE.MeshBasicMaterial).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      apiRef.current = null;
    };
     
  }, []);

  return <div ref={mountRef} className={className} aria-hidden />;
}
