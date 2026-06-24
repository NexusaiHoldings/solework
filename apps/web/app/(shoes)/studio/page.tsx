import type { JSX } from "react";
import { fetchActiveSilhouettes, fetchColorways } from "@/lib/shoes/design-sessions";
import StudioClient from "./StudioClient";

export const metadata = {
  title: "Design Studio — Solework",
  description: "Configure your custom 3D-printed shoe — silhouette, colorway, sole, and toe shape.",
};

export default async function StudioPage(): Promise<JSX.Element> {
  const [silhouettes, colorways] = await Promise.all([
    fetchActiveSilhouettes(),
    fetchColorways(),
  ]);

  return (
    <main>
      <h1>Design Studio</h1>
      <p>
        Configure your custom shoe — pick a silhouette, colorway, sole profile, and toe shape.
        Save your design to request a 3D-printed pair.
      </p>

      <StudioClient silhouettes={silhouettes} colorways={colorways} />

      <section style={{ marginTop: "3rem", borderTop: "1px solid #e5e7eb", paddingTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>How it works</h2>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Choose your silhouette and colorway from the options above.</li>
          <li>Select a sole profile and toe shape — the preview updates live.</li>
          <li>Click <strong>Check printability</strong> to run our FDM/SLA constraint validator.</li>
          <li>Click <strong>Save design</strong> to create a design session in your account.</li>
          <li>From your <a href="/orders">orders page</a>, request a print when you&apos;re ready.</li>
        </ol>
      </section>
    </main>
  );
}
