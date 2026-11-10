"use client";

/**
 * Think Leo — FeedSky (three.js, lazy)
 * ────────────────────────────────────
 * The Leo Feed backdrop: a slow galaxy of chunky 3D stars and spinning
 * diamonds drifting upward behind the cards — the "the feed is alive"
 * feeling, in real 3D. Mirrors SpaceSky's phone manners:
 *   · three.js is dynamically imported (never in the main bundle)
 *   · pixel ratio capped at 1.5 — crisp, but cheap on small screens
 *   · the render loop pauses whenever the tab is hidden (battery)
 *   · everything is disposed on unmount — zero GPU leaks
 */

import { useEffect, useRef } from "react";

export function FeedSky({
  className = "",
  opacity = 0.7,
}: {
  className?: string;
  opacity?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let teardown: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed || !host) return;

        const w = host.clientWidth || window.innerWidth;
        const h = host.clientHeight || window.innerHeight;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
        renderer.setSize(w, h);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 100);
        camera.position.z = 12;

        /* a soft galaxy dust field — tiny points drifting up */
        const DUST = 200;
        const pos = new Float32Array(DUST * 3);
        const speed = new Float32Array(DUST);
        for (let i = 0; i < DUST; i++) {
          pos[i * 3] = (Math.random() - 0.5) * 30;
          pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
          pos[i * 3 + 2] = -4 - Math.random() * 14;
          speed[i] = 0.15 + Math.random() * 0.45;
        }
        const dustGeo = new THREE.BufferGeometry();
        dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const dustMat = new THREE.PointsMaterial({
          color: 0xffffff,
          size: 0.09,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        });
        const dust = new THREE.Points(dustGeo, dustMat);
        scene.add(dust);

        /* chunky 3D treasures — octahedron stars + icosahedron gems */
        const PALETTE = [0xffc93c, 0xff5a8c, 0x9b5de5, 0x2ec4b6, 0x58cc02];
        const treasures: {
          mesh: import("three").Mesh;
          spin: number;
          rise: number;
          sway: number;
          phase: number;
        }[] = [];
        for (let i = 0; i < 14; i++) {
          const kind = i % 2 === 0 ? "star" : "gem";
          const geo =
            kind === "star"
              ? new THREE.OctahedronGeometry(0.5, 0)
              : new THREE.IcosahedronGeometry(0.42, 0);
          const mat = new THREE.MeshStandardMaterial({
            color: PALETTE[i % PALETTE.length],
            roughness: 0.25,
            metalness: 0.55,
            transparent: true,
            opacity: 0.85,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(
            (Math.random() - 0.5) * 22,
            (Math.random() - 0.5) * 18,
            -3 - Math.random() * 10
          );
          scene.add(mesh);
          treasures.push({
            mesh,
            spin: (Math.random() - 0.5) * 0.01,
            rise: 0.12 + Math.random() * 0.25,
            sway: 0.3 + Math.random() * 0.7,
            phase: Math.random() * Math.PI * 2,
          });
        }

        scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(4, 6, 6);
        scene.add(key);

        /* pause the loop when the tab hides — phone battery first */
        let running = true;
        const clock = new THREE.Clock();
        const onVis = () => {
          running = document.visibilityState === "visible";
          if (running) {
            clock.getDelta(); // swallow the pause so nothing jumps
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(loop);
          } else {
            cancelAnimationFrame(raf);
          }
        };

        const loop = () => {
          if (disposed) return;
          const dt = Math.min(0.05, clock.getDelta());
          const t = clock.elapsedTime;

          const arr = dustGeo.getAttribute("position") as import("three").BufferAttribute;
          for (let i = 0; i < DUST; i++) {
            let y = arr.getY(i) + speed[i] * dt;
            if (y > 12) y = -12;
            arr.setY(i, y);
          }
          arr.needsUpdate = true;

          treasures.forEach((o) => {
            o.mesh.rotation.x += o.spin;
            o.mesh.rotation.y += o.spin * 1.4;
            o.mesh.position.y += o.rise * dt;
            if (o.mesh.position.y > 11) o.mesh.position.y = -11;
            o.mesh.position.x += Math.sin(t * o.sway + o.phase) * 0.004;
          });

          renderer.render(scene, camera);
          if (running && !disposed) raf = requestAnimationFrame(loop);
        };
        onVis();
        document.addEventListener("visibilitychange", onVis);

        /* stay crisp through rotations and window resizes (Egg3D's pattern) */
        const ro = new ResizeObserver(() => {
          const nw = host.clientWidth || 1;
          const nh = host.clientHeight || 1;
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh, false); // CSS owns the style size
        });
        ro.observe(host);

        teardown = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          document.removeEventListener("visibilitychange", onVis);
          renderer.dispose();
          dustGeo.dispose();
          dustMat.dispose();
          treasures.forEach((o) => {
            o.mesh.geometry.dispose();
            (o.mesh.material as import("three").Material).dispose();
          });
          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch {
        /* three.js failed to load — the CSS gradients still carry the look */
      }
    })();

    return () => {
      disposed = true;
      if (teardown) teardown();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ opacity }}
      aria-hidden
    />
  );
}
