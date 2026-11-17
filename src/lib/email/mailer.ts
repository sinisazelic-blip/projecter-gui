// src/lib/email/mailer.ts
import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  provider?: "resend" | "smtp" | "dry-run";
}

const DEFAULT_FROM = process.env.FLUXA_SMTP_FROM || "Fluxa SaaS <info@fluxa.ba>";
const DEFAULT_REPLY_TO = process.env.FLUXA_REPLY_TO || "info@fluxa.ba";

/**
 * Glavna funkcija za slanje sistemskih emailova iz Fluxe.
 * 
 * Podržava:
 * 1. Resend API (ako je postavljen RESEND_API_KEY)
 * 2. Standardni SMTP / Brevo / Gmail (preko nodemailer-a ako je postavljen FLUXA_SMTP_HOST)
 * 3. Dry-run log (ako podaci nisu konfigurisani, ne ruši aplikaciju)
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const toList = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  const from = options.from || DEFAULT_FROM;
  const replyTo = options.replyTo || DEFAULT_REPLY_TO;

  // 1. Ako postoji RESEND_API_KEY, koristi moderan i ultra-pouzdan Resend API
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          reply_to: replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Resend API error");
      }

      return {
        ok: true,
        messageId: data.id,
        provider: "resend",
      };
    } catch (err: any) {
      console.error("[mailer] Resend slanje nije uspjelo:", err.message);
      return { ok: false, error: err.message, provider: "resend" };
    }
  }

  // 2. Ako postoji SMTP konfiguracija (Brevo, Gmail, cPanel)
  const smtpHost = process.env.FLUXA_SMTP_HOST?.trim();
  const smtpUser = process.env.FLUXA_SMTP_USER?.trim();
  const smtpPass = process.env.FLUXA_SMTP_PASS?.trim();
  const smtpPort = Number(process.env.FLUXA_SMTP_PORT || 587);

  if (smtpHost && smtpHost !== "..." && smtpUser && smtpUser !== "...") {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const info = await transporter.sendMail({
        from,
        to: toList,
        replyTo,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      return {
        ok: true,
        messageId: info.messageId,
        provider: "smtp",
      };
    } catch (err: any) {
      console.error("[mailer] SMTP slanje nije uspjelo:", err.message);
      return { ok: false, error: err.message, provider: "smtp" };
    }
  }

  // 3. Dry-run fallback ako ništa nije podešeno
  console.log(
    `[mailer] DRY-RUN (nema RESEND_API_KEY niti SMTP podešavanja):`,
    `To: ${toList} | Subject: ${options.subject} | Reply-To: ${replyTo}`
  );

  return {
    ok: true,
    messageId: `dry-run-${Date.now()}`,
    provider: "dry-run",
  };
}

// =========================================================================
// ŠABLONI SISTEMSKIH EMAILOVA (Responzivan, čist, profesionalan HTML)
// =========================================================================

export function buildGracePeriodEmailHtml(params: {
  tenantName: string;
  clientName: string;
  productName: string;
  monthlyPriceFormatted: string;
  graceDaysLeft: number;
  contactEmail: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .badge { display: inline-block; background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; margin-top: 8px; }
    .content { font-size: 14px; line-height: 1.6; color: #334155; }
    .info-box { background: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; border-left: 4px solid #3b82f6; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Fluxa SaaS · Obavještenje o dospijeću licence</h1>
      <div class="badge">⏳ Tolerancija uplate (Grace period do 14. u mjesecu)</div>
    </div>
    
    <div class="content">
      <p>Poštovani <strong>${params.clientName}</strong>,</p>
      
      <p>Obavještavamo vas da je istekla pretplata za zakup softverske licence <strong>${params.productName}</strong> (organizacija: <em>${params.tenantName}</em>).</p>
      
      <div class="info-box">
        <div><strong>Softver:</strong> ${params.productName}</div>
        <div><strong>Iznos zakupa:</strong> ${params.monthlyPriceFormatted}</div>
        <div><strong>Status sistema:</strong> Uredno aktivan (Tolerancija još ${params.graceDaysLeft} dana)</div>
        <div><strong>Krajnji rok za uplatu:</strong> 14. u tekućem mjesecu</div>
      </div>
      
      <p>Vaš sistem i sve kase/menadžeri na terenu <strong>funkcionišu potpuno nesmetano</strong> u toku ovog perioda tolerancije, kako bismo vam omogućili dovoljno vremena za knjiženje i realizaciju bankovnog prenosa.</p>
      
      <p>Molimo vas da blagovremeno izvršite uplatu kako ne bi došlo do automatske obustave servisa nakon 14. u mjesecu. Zvanična fiskalna faktura sa QR kodom biće izdata nakon knjiženja uplate kroz bankovni izvod.</p>
      
      <p>Ako ste uplatu već izvršili, molimo vas da zanemarite ovu poruku ili nam pošaljete potvrdu jednostavnim odgovorom na ovaj email.</p>
    </div>
    
    <div class="footer">
      <div><strong>Fluxa Engine & Podrška</strong></div>
      <div>Email: <a href="mailto:${params.contactEmail}">${params.contactEmail}</a></div>
      <div>Ova poruka je automatski generisana od strane Fluxa SaaS sistema. Na ovu poruku možete odgovoriti direktno (Reply).</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildPaymentReceiptEmailHtml(params: {
  tenantName: string;
  clientName: string;
  productName: string;
  amountFormatted: string;
  months: number;
  newEndsAtFormatted: string;
  contactEmail: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; margin-top: 8px; }
    .content { font-size: 14px; line-height: 1.6; color: #334155; }
    .info-box { background: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; border-left: 4px solid #10b981; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Fluxa SaaS · Potvrda o uplati i produženju licence</h1>
      <div class="badge">✓ Licenca uspješno produžena</div>
    </div>
    
    <div class="content">
      <p>Poštovani <strong>${params.clientName}</strong>,</p>
      
      <p>Zahvaljujemo se na vašoj uplati za zakup licence <strong>${params.productName}</strong>.</p>
      
      <div class="info-box">
        <div><strong>Evidentirana uplata:</strong> ${params.amountFormatted}</div>
        <div><strong>Period zakupa:</strong> ${params.months} mj.</div>
        <div><strong>Novi rok važenja licence:</strong> ${params.newEndsAtFormatted}</div>
        <div><strong>Status licence:</strong> AKTIVAN / LIVE</div>
      </div>
      
      <p>Vaš softver na terenu je automatski sinhronizovan i produžen do navedenog datuma. Nije potrebna nikakva dodatna akcija na vašim radnim stanicama ili kasama.</p>
    </div>
    
    <div class="footer">
      <div><strong>Fluxa Engine & Podrška</strong></div>
      <div>Email: <a href="mailto:${params.contactEmail}">${params.contactEmail}</a></div>
      <div>Hvala vam na ukazanom povjerenju! Na ovu poruku možete odgovoriti direktno (Reply).</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
