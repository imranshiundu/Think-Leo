"use client";

/**
 * Think Leo — PopSky (three.js, lazy)
 * ───────────────────────────────────
 * The LEO POP backdrop: a slow drift of soft candy bubbles rising past
 * the jar, plus two big blurred orbs for depth. Loaded only when the
 * arcade opens (dynamic import), pixel ratio capped for phones, paused
 * when the tab hides, fully disposed on unmount — the same battery
 * manners as SpaceSky (§14.6).
 */

import { useEffect, useRef } from "react";

const CANDY = [0xffb020, 0x58cc02, 0xff5a8c, 0x9b5de5, 0x2ec4b6];

export function PopSky({
  className = "",
  opacity = 0.5,
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
        const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 60);
        camera.position.z = 14;

        /* the bubble swarm — low-poly spheres on a slow elevator ride */
        const bubbles: {
          mesh: InstanceType<typeof THREE.Mesh>;
          speed: number;
          spin: number;
        }[] = [];
        const geo = new THREE.IcosahedronGeometry(1, 1);
        for (let i = 0; i < 22; i++) {
          const mat = new THREE.MeshStandardMaterial({
            color: CANDY[i % CANDY.length],
            transparent: true,
            opacity: 0.34 + Math.random() * 0.2,
            flatShading: true,
          });
          const m = new THREE.Mesh(geo, mat);
          m.scale.setScalar(0.35 + Math.random() * 0.85);
          m.position.set(
            (Math.random() - 0.5) * 22,
            -8 + Math.random() * 18,
            -4 - Math.random() * 6
          );
          scene.add(m);
          bubbles.push({ mesh: m, speed: 0.25 + Math.random() * 0.6, spin: (Math.random() - 0.5) * 0.01 });
        }

        const light = new THREE.DirectionalLight(0xffffff, 1.1);
        light.position.set(4, 6, 8);
        scene.add(light, new THREE.AmbientLight(0xffffff, 0.75));

        const loop = () => {
          raf = requestAnimationFrame(loop);
          for (const b of bubbles) {
            b.mesh.position.y += b.speed * 0.016;
            b.mesh.rotation.y += b.spin;
            b.mesh.rotation.x += b.spin * 0.6;
            if (b.mesh.position.y > 10) b.mesh.position.y = -10; // wrap to the bottom
          }
          renderer.render(scene, camera);
        };

        const onVis = () => {
          cancelAnimationFrame(raf);
          if (!document.hidden) loop();
        };
        document.addEventListener("visibilitychange", onVis);
        loop();

        teardown = () => {
          cancelAnimationFrame(raf);
          document.removeEventListener("visibilitychange", onVis);
          geo.dispose();
          bubbles.forEach((b) => (b.mesh.material as InstanceType<typeof THREE.Material>).dispose());
          renderer.dispose();
          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch {
        /* three.js is a bonus — the jar plays fine without it */
      }
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return <div ref={hostRef} className={className} style={{ opacity }} aria-hidden />;
}
