import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <h1 className="display">Account not found</h1>
      <p className="lede">
        <Link href="/accounts">Back to all accounts</Link>
      </p>
    </section>
  );
}
