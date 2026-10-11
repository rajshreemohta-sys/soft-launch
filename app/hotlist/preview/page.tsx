import type { Metadata } from "next";

export const metadata: Metadata = { title: "Email preview" };

// Phase 7 replaces this with the latest Hot List email.
export default function PreviewPage() {
  return (
    <section className="section">
      <p className="eyebrow">Email preview</p>
      <h1 className="display">The Monday and Thursday email</h1>
      <div className="empty" style={{ marginTop: 32 }}>
        <strong>No Hot List email has been built yet.</strong>
        The preview appears here once the first Hot List runs.
      </div>
    </section>
  );
}
