/**
 * Branded Picbo transactional email templates.
 *
 * Every template returns both HTML and plain text. Rules applied throughout:
 *  - table-based layout and inline styles (Outlook and Gmail strip <style>)
 *  - no external CSS, no web fonts, no remote images beyond the app origin
 *  - all interpolated values are HTML-escaped: a display name comes from
 *    user_metadata, which is attacker-controlled on an OAuth sign-up
 *  - light background with the Picbo violet accent, per the design directive
 */

const BRAND={
  primary:"#6D5EF8",
  accent:"#06B6D4",
  ink:"#0B1220",
  muted:"#64748B",
  border:"#E2E8F0",
  canvas:"#F8FAFC",
  surface:"#FFFFFF"
};

export function escapeHtml(value:string):string{
  return value
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function shell(opts:{title:string;preheader:string;bodyHtml:string;appUrl:string}):string{
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});border-radius:10px;color:#fff;font-weight:800;font-size:17px;text-align:center;line-height:36px;">P</td>
<td style="padding-left:10px;font-size:17px;font-weight:700;color:${BRAND.ink};">Picbo</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 32px 32px;">${opts.bodyHtml}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:20px 32px;text-align:center;color:${BRAND.muted};font-size:12px;line-height:18px;">
Picbo — AI product-to-advertising platform<br>
<a href="${escapeHtml(opts.appUrl)}" style="color:${BRAND.muted};text-decoration:underline;">${escapeHtml(opts.appUrl.replace(/^https?:\/\//,""))}</a>
</td></tr></table>
</td></tr></table></body></html>`;
}

function button(href:string,label:string):string{
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
<td style="background:${BRAND.primary};border-radius:10px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function p(text:string):string{
  return `<p style="margin:0 0 14px;font-size:15px;line-height:23px;color:${BRAND.ink};">${text}</p>`;
}

export interface SignupTemplateInput{name?:string|null;appUrl:string}

export function signupTemplate(input:SignupTemplateInput):{subject:string;html:string;text:string}{
  const greeting=input.name?`Welcome, ${escapeHtml(input.name)}`:"Welcome to Picbo";
  const html=shell({
    title:"Welcome to Picbo",
    preheader:"Your Picbo account is ready — turn one product photo into a full campaign.",
    appUrl:input.appUrl,
    bodyHtml:
      `<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${BRAND.ink};">${greeting}</h1>`+
      p("Your account is ready. Picbo turns a single product photo into studio photoshoots, static ads, video and Shorts — all keeping your product's real shape, packaging and colours intact.")+
      p("A good first step is to add your product, then run a photoshoot from it. Everything you generate stays in your library with its full version history.")+
      button(`${input.appUrl}/products`,"Add your first product")+
      `<p style="margin:20px 0 0;padding-top:18px;border-top:1px solid ${BRAND.border};font-size:13px;line-height:20px;color:${BRAND.muted};">You're receiving this because an account was created with this email address. If that wasn't you, please ignore this message and no further action is needed.</p>`
  });
  const text=[
    input.name?`Welcome, ${input.name}`:"Welcome to Picbo",
    "",
    "Your account is ready. Picbo turns a single product photo into studio photoshoots, static ads, video and Shorts, keeping your product's real shape, packaging and colours intact.",
    "",
    `Add your first product: ${input.appUrl}/products`,
    "",
    "You're receiving this because an account was created with this email address. If that wasn't you, please ignore this message."
  ].join("\n");
  return {subject:"Welcome to Picbo",html,text};
}

export interface SigninTemplateInput{
  name?:string|null;
  appUrl:string;
  method:"password"|"google";
  ip?:string|null;
  userAgent?:string|null;
  when:Date;
}

/** Human-readable browser/OS summary. Never render a raw UA string into HTML. */
export function describeUserAgent(ua?:string|null):string{
  if(!ua)return "Unknown device";
  const browser=/Edg\//.test(ua)?"Edge":/OPR\//.test(ua)?"Opera":/Chrome\//.test(ua)?"Chrome":/Safari\//.test(ua)?"Safari":/Firefox\//.test(ua)?"Firefox":"Unknown browser";
  const os=/iPhone|iPad/.test(ua)?"iOS":/Android/.test(ua)?"Android":/Mac OS X/.test(ua)?"macOS":/Windows/.test(ua)?"Windows":/Linux/.test(ua)?"Linux":"Unknown OS";
  return `${browser} on ${os}`;
}

export function signinTemplate(input:SigninTemplateInput):{subject:string;html:string;text:string}{
  const methodLabel=input.method==="google"?"Google":"email and password";
  const device=describeUserAgent(input.userAgent);
  const when=input.when.toUTCString();
  const ip=input.ip||"Not available";

  const detailRow=(label:string,value:string)=>
    `<tr><td style="padding:7px 0;font-size:13px;color:${BRAND.muted};width:100px;">${escapeHtml(label)}</td>
     <td style="padding:7px 0;font-size:13px;color:${BRAND.ink};font-weight:500;">${escapeHtml(value)}</td></tr>`;

  const html=shell({
    title:"New sign-in to Picbo",
    preheader:`New sign-in with ${methodLabel} — ${device}`,
    appUrl:input.appUrl,
    bodyHtml:
      `<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${BRAND.ink};">New sign-in to your Picbo account</h1>`+
      p(`${input.name?escapeHtml(input.name)+", your":"Your"} account was just signed in to using ${escapeHtml(methodLabel)}.`)+
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;padding:14px 16px;background:${BRAND.canvas};border:1px solid ${BRAND.border};border-radius:12px;">
        ${detailRow("When",when)}
        ${detailRow("Method",methodLabel)}
        ${detailRow("Device",device)}
        ${detailRow("IP address",ip)}
      </table>`+
      p("If this was you, there's nothing to do.")+
      `<p style="margin:0 0 14px;font-size:15px;line-height:23px;color:${BRAND.ink};"><strong>If this wasn't you</strong>, change your password immediately and review your account settings.</p>`+
      button(`${input.appUrl}/settings`,"Review account security")+
      `<p style="margin:20px 0 0;padding-top:18px;border-top:1px solid ${BRAND.border};font-size:13px;line-height:20px;color:${BRAND.muted};">Picbo sends this security notification for every sign-in. We will never email you asking for your password.</p>`
  });

  const text=[
    "New sign-in to your Picbo account",
    "",
    `Your account was just signed in to using ${methodLabel}.`,
    "",
    `When:       ${when}`,
    `Method:     ${methodLabel}`,
    `Device:     ${device}`,
    `IP address: ${ip}`,
    "",
    "If this was you, there's nothing to do.",
    "If this wasn't you, change your password immediately:",
    `${input.appUrl}/settings`,
    "",
    "Picbo sends this security notification for every sign-in. We will never email you asking for your password."
  ].join("\n");

  return {subject:"New sign-in to your Picbo account",html,text};
}
