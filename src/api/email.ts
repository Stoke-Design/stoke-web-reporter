import nodemailer from 'nodemailer';

// ── Logo ───────────────────────────────────────────────────────────────────────
// Hosted PNG — place logo-white.png in public/ so it is served at this URL.
// Email clients cache remote images; hosting avoids base64 bloat.
const LOGO_URL = 'https://reports.stokedesign.co/logo-white.png';

// ── Email template ─────────────────────────────────────────────────────────────

export function buildMonthlyReportEmail(params: {
  firstName: string;
  clientName: string;
  dashboardUrl: string;
  month: string;
  reportSummary: string;
  /** Override the period label shown in the email subject & heading. Defaults to `month`. */
  period?: string;
}): { subject: string; html: string } {
  const { firstName, clientName, dashboardUrl, month, reportSummary, period } = params;
  const periodLabel = period || month;
  const subject = `Your ${periodLabel} Website Report — ${clientName}`;

  // Convert report summary paragraphs into HTML <p> tags
  const summaryHtml = reportSummary
    ? reportSummary
      .split(/\n\n+/)
      .filter(p => p.trim())
      .map(p => `<p style="margin:0 0 16px 0;line-height:1.7;color:#374151;">${p.trim()}</p>`)
      .join('')
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background-color:#0a0a0a;padding:28px 40px;">
              <img src="${LOGO_URL}" width="200" height="33" alt="Stoke Design" style="display:block;border:0;outline:none;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px 40px;">

              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#e35e3d;">Website Report</p>
              <h1 style="margin:0 0 24px 0;font-size:26px;font-weight:700;color:#111827;line-height:1.3;">${periodLabel} Website Performance</h1>

              ${summaryHtml || `<p style="margin:0 0 16px 0;line-height:1.7;color:#374151;">Your ${periodLabel} website performance report is now ready to view. Head to your dashboard for a full breakdown of how your site is performing.</p>`}

              <!-- Contact line -->
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.7;color:#6b7280;">If you have any questions about your report, please don't hesitate to reach out to the Stoke team at <a href="mailto:web@stokedesign.co" style="color:#e35e3d;text-decoration:none;">web@stokedesign.co</a> or call us on <strong style="color:#374151;">03&nbsp;5312&nbsp;7136</strong>. <br><br>The Stoke Design Team</p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#e35e3d;">
                    <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">View Your Full Report &rarr;</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">If the button above doesn't work, copy and paste this link into your browser:<br/>
                <a href="${dashboardUrl}" style="color:#e35e3d;word-break:break-all;">${dashboardUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a0a0a;padding:24px 40px;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#6b7280;">Data presented in this report is sourced from Google Search Console, Google Analytics 4, MainWP, PageSpeed Insights, and Uptime Monitor. Figures may vary between platforms due to differences in data collection methods and attribution. All data is provided for indicative purposes only.<br><br> &copy; 2026 Stoke Design Co Pty Ltd T/A Stoke Design&trade;. All Rights Reserved.</p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ── Send via Postmark SMTP ─────────────────────────────────────────────────────

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  serverToken: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}): Promise<void> {
  const { to, subject, html, serverToken, fromEmail, fromName, replyTo } = params;

  const transporter = nodemailer.createTransport({
    host: 'smtp.postmarkapp.com',
    port: 2525,
    secure: false,
    auth: {
      user: serverToken,
      pass: serverToken,
    },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}
