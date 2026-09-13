import Link from "next/link";
import type {Metadata} from "next";

export const metadata:Metadata={
  title:"Privacy Policy",
  description:"How Picbo collects, uses, stores and deletes your data.",
  robots:{index:true,follow:true},
  alternates:{canonical:"/legal/privacy"}
};

/**
 * Privacy policy.
 *
 * The app had no legal pages at all, which is a launch blocker in every
 * jurisdiction it would plausibly sell into and a hard requirement for Paddle
 * and Google OAuth verification alike.
 *
 * This is written to describe what the code **actually does** — the data it
 * really stores, the sub-processors it really calls — rather than being
 * generic boilerplate. It still needs a lawyer's review before launch; that is
 * recorded in PICBO_REMAINING_ISSUES.md and stated on the page itself.
 */
export default function PrivacyPolicy(){
  return <main className="legal">
    <div className="legal-inner">
      <Link href="/" className="legal-back">← Back to Picbo</Link>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 12 September 2026</p>

      <div className="notice warning" role="note">
        <strong>Pre-launch notice.</strong> This policy accurately describes the data the
        product handles today, but it has not yet been reviewed by a qualified lawyer.
        It must be before Picbo accepts real customers.
      </div>

      <h2>Who we are</h2>
      <p>
        Picbo (&ldquo;we&rdquo;) provides an AI product-photography and advertising platform.
        This policy explains what we collect, why, how long we keep it, and how you
        remove it.
      </p>

      <h2>What we collect</h2>
      <table className="table">
        <thead><tr><th>Data</th><th>Why</th><th>Retention</th></tr></thead>
        <tbody>
          <tr><td>Email address, name</td><td>Account identity and sign-in</td><td>Until you delete your account</td></tr>
          <tr><td>Images you upload</td><td>To generate the content you request</td><td>Until you delete them, or 30 days after account deletion</td></tr>
          <tr><td>Generated images and video</td><td>Your asset library</td><td>Same as above</td></tr>
          <tr><td>Prompts you write</td><td>To run generation, and to show your own history</td><td>Same as above</td></tr>
          <tr><td>Usage and credit records</td><td>Billing accuracy and fraud prevention</td><td>7 years (financial record-keeping)</td></tr>
          <tr><td>Sign-in events (time, IP, browser)</td><td>Security notifications and abuse detection</td><td>12 months</td></tr>
        </tbody>
      </table>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not use your images or prompts to train our own models.</li>
        <li>We do not show you third-party advertising.</li>
      </ul>

      <h2>Who processes your data</h2>
      <p>To run the product we send some data to these sub-processors:</p>
      <table className="table">
        <thead><tr><th>Processor</th><th>What they receive</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Account records, images, all application data (hosting and storage)</td></tr>
          <tr><td>AI providers (Groq, Cerebras, OpenRouter, Anthropic, Google, fal.ai)</td><td>The prompt and any source image for a generation you request</td></tr>
          <tr><td>Paddle</td><td>Billing details. Paddle is the merchant of record and handles payment data directly — we never see your card number.</td></tr>
          <tr><td>Resend</td><td>Your email address, to deliver account and security emails</td></tr>
        </tbody>
      </table>
      <p className="muted">
        Prompts and source images are sent to whichever AI provider serves your request.
        Those providers have their own retention policies, which we do not control.
      </p>

      <h2>Your rights</h2>
      <p>Wherever you live, you can:</p>
      <ul>
        <li><strong>Export your data</strong> — a machine-readable copy of your account, products, projects and asset records, from <Link href="/settings">Settings</Link>.</li>
        <li><strong>Delete your account</strong> — permanently, from <Link href="/settings">Settings</Link>. Deletion removes your images and account records; billing records are retained where the law requires.</li>
        <li><strong>Correct your data</strong> — edit it in the app, or ask us.</li>
        <li><strong>Object or restrict</strong> — contact us and we will respond within 30 days.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Picbo sets only the cookies it needs to work: a session cookie so you stay signed
        in, and a preference cookie for your light/dark choice. There are no advertising
        or cross-site tracking cookies, which is why you are not being shown a consent
        banner.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest. Your files live in a private bucket and
        are served only through short-lived signed links. Access is scoped per workspace
        and enforced in the database itself, not only in the application.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions or requests: <a href="mailto:privacy@picbo.ai">privacy@picbo.ai</a>.
      </p>
    </div>
  </main>;
}
