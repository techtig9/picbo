import {AppShell} from "@/components/app-shell";
import Link from "next/link";

const FAQS=[
  ["How do credits work?","Every AI generation (photos, ad copy, video renders) costs credits based on task and quality. Your balance and usage history are on the Billing page."],
  ["Which AI providers does Picbo use?","Text and copy generation runs through Groq, Cerebras and OpenRouter with automatic fallback, plus optional Claude. Image generation and Product Identity analysis use Gemini/Claude vision and fal.ai."],
  ["Why did my generation get blocked?","Every prompt is checked against our content policy before it runs. If something was blocked in error, try rephrasing — ordinary product and ad content should never be flagged."],
  ["How do I keep my product looking consistent across generations?","Upload reference photos on a product's page and run Product Identity analysis — it captures logo, packaging, shape and color rules that guide future generations."],
  ["Can I invite my team?","Yes — go to Team & Agency to invite by email and assign roles (Admin, Manager, Editor, Viewer)."],
  ["What happens if a video render fails?","Renders retry automatically with backoff. If all retries are exhausted, the render is marked failed and your credits are refunded automatically — check the render status panel for details."]
];

export default function Help(){
  return <AppShell><div className="content">
    <div className="eyebrow">SUPPORT</div>
    <h1 className="title">Help Center</h1>
    <p className="muted">Common questions about Picbo.ai. Can't find what you need? Ask <Link href="/lumi">Lumi</Link>, our in-app assistant.</p>

    <div className="grid three" style={{marginTop:22}}>
      {FAQS.map(([q,a])=>(
        <div className="card" key={q}>
          <h3>{q}</h3>
          <p className="muted">{a}</p>
        </div>
      ))}
    </div>

    <div className="card" style={{marginTop:22,maxWidth:520}}>
      <h3>Still stuck?</h3>
      <p className="muted">Open <Link href="/lumi">Lumi</Link> for context-aware help, or reach out via your account email for anything account- or billing-specific.</p>
    </div>
  </div></AppShell>;
}
