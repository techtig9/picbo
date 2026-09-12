import Link from "next/link";
import type {Metadata} from "next";
import {PLANS} from "@/lib/billing/plans";

export const metadata:Metadata={
  title:"Terms of Service",
  description:"The terms that govern your use of Picbo.",
  robots:{index:true,follow:true},
  alternates:{canonical:"/legal/terms"}
};

export default function Terms(){
  return <main className="legal">
    <div className="legal-inner">
      <Link href="/" className="legal-back">← Back to Picbo</Link>
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: 12 September 2026</p>

      <div className="notice warning" role="note">
        <strong>Pre-launch notice.</strong> These terms describe how the product actually
        behaves today, but they have not been reviewed by a qualified lawyer and must be
        before Picbo accepts real customers.
      </div>

      <h2>The service</h2>
      <p>
        Picbo generates images, video and advertising copy from prompts and product
        photos you provide, using third-party AI models.
      </p>

      <h2>Your content</h2>
      <p>
        <strong>You keep ownership of what you upload and what you generate.</strong> We
        claim no rights over your product photos or your outputs beyond what we need to
        operate the service for you — storing them, showing them back to you, and sending
        them to the AI provider that fulfils your request.
      </p>
      <p>
        You are responsible for having the right to upload what you upload. Do not upload
        content you do not own or have permission to use.
      </p>

      <h2>Acceptable use</h2>
      <p>You may not use Picbo to create:</p>
      <ul>
        <li>Content depicting real people without their consent, including public figures in fabricated situations</li>
        <li>Sexual content involving minors, or any content that sexualises a minor</li>
        <li>Content intended to deceive about a real product&apos;s properties, safety or origin</li>
        <li>Content that infringes someone else&apos;s trademark or copyright</li>
        <li>Harassment, hate speech, or content promoting violence</li>
      </ul>
      <p>
        We screen prompts automatically and may suspend accounts that breach these rules.
      </p>

      <h2>Credits and billing</h2>
      <ul>
        <li>Generation consumes credits. Each plan includes a monthly allowance.</li>
        <li>
          <strong>A failed generation is refunded automatically.</strong> If a generation
          fails, is cancelled before it starts, or produces no usable output, the credits
          are returned to your balance.
        </li>
        <li>Credits are consumed at the moment a generation is submitted, not when it completes.</li>
        <li>Plans renew automatically until cancelled. Cancelling stops the next renewal; you keep access for the period you have already paid for.</li>
        <li>Paddle is our merchant of record and handles payments, invoices and tax.</li>
      </ul>

      <h3>Current plans</h3>
      <table className="table">
        <thead><tr><th>Plan</th><th>Monthly</th><th>Credits / month</th></tr></thead>
        <tbody>
          {PLANS.map(p=>
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.monthlyPriceCents===0?"Free":`$${(p.monthlyPriceCents/100).toFixed(0)}`}</td>
              <td>{p.creditsPerMonth.toLocaleString()}</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Availability</h2>
      <p>
        We aim for high availability but do not currently offer a contractual uptime
        guarantee. Picbo depends on third-party AI providers; when one is unavailable we
        route around it where we can, and refund credits for anything that fails.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from <Link href="/settings">Settings</Link>.
        We may suspend accounts that breach the acceptable-use rules above, or that are
        used to abuse the service.
      </p>

      <h2>Liability</h2>
      <p>
        Picbo is provided &ldquo;as is&rdquo;. To the extent the law allows, our liability
        is limited to the amount you paid us in the twelve months before the claim.
        Nothing here limits liability that cannot lawfully be limited.
      </p>

      <h2>Contact</h2>
      <p><a href="mailto:support@picbo.ai">support@picbo.ai</a></p>
    </div>
  </main>;
}
