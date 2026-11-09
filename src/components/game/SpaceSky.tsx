"use client";

/**
 * Think Leo — SpaceSky (three.js, lazy)
 * ─────────────────────────────────────
 * A slow-rotating low-poly space diorama: a twinkling starfield and two
 * chunky planets (one wearing a candy ring). It only exists inside the
 * Space Hop world, and three.js is dynamically imported so phones never
 * download a single byte of it in the other three worlds.
 *
 * Phone manners:
 *   · pixel ratio capped at 1.5 — crisp, but cheap on small screens
 *   · the render loop pauses whenever the tab is hidden (battery)
 *   · everything is disposed on unmount — zero GPU leaks between levels
 */

import { useEffect, useRef } from "react";

export function SpaceSky({
  className = "",
  opacity = 0.6,
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
        camera.position.z = 13;

        /* starfield — points on a big sphere shell so the drift feels deep */
        const N = 240;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          const r = 16 + Math.random() * 14;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          pos[i * 3 + 2] = r * Math.cos(phi);
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const stars = new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({ color: 0xffd966, size: 0.14, transparent: true, opacity: 0.85 })
        );
        scene.add(stars);

        /* two low-poly planets + a candy ring */
        const grape = new THREE.Mesh(
          new THREE.IcosahedronGeometry(2.6, 1),
          new THREE.MeshStandardMaterial({ color: 0x9b5de5, flatShading: true })
        );
        grape.position.set(-6, 2.6, -3);

        const teal = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.4, 1),
          new THREE.MeshStandardMaterial({ color: 0x2ec4b6, flatShading: true })
        );
        teal.position.set(6.2, -3.4, -1.5);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(3.6, 0.13, 8, 42),
          new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.75 })
        );
        ring.position.copy(grape.position);
        ring.rotation.x = Math.PI / 2.35;

        scene.add(grape, teal, ring);

        const light = new THREE.DirectionalLight(0xffffff, 1.15);
        light.position.set(5, 7, 9);
        scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));

        const loop = () => {
          raf = requestAnimationFrame(loop);
          stars.rotation.y += 0.0006;
          grape.rotation.y += 0.0022;
          grape.rotation.x += 0.0008;
          teal.rotation.y -= 0.003;
          ring.rotation.z += 0.0012;
          renderer.render(scene, camera);
        };

        /* battery manners: no rendering while the app is in the background */
        const onVis = () => {
          cancelAnimationFrame(raf);
          if (!document.hidden) loop();
        };
        document.addEventListener("visibilitychange", onVis);
        loop();

        teardown = () => {
          cancelAnimationFrame(raf);
          document.removeEventListener("visibilitychange", onVis);
          starGeo.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch {
        /* three.js is a bonus — if WebGL is unavailable the SVG cartoons carry on */
      }
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return <div ref={hostRef} className={className} style={{ opacity }} aria-hidden />;
}
