// Plain, dependency-free email templates. No templating engine — just typed
// builders that return the subject plus HTML and plain-text bodies. Keep the
// markup simple and inline-styled so it survives every mail client.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = 'WaSphere';
const ACCENT = '#22c55e';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Shared shell: a centered card with a brand header and a primary button. */
function layout(opts: {
  heading: string;
  bodyHtml: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
}): string {
  const url = escapeHtml(opts.buttonUrl);
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #f0f0f0;">
                <span style="font-size:18px;font-weight:700;color:#0a0a0a;">${BRAND}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#0a0a0a;">${escapeHtml(opts.heading)}</h1>
                ${opts.bodyHtml}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:8px;background:${ACCENT};">
                      <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(opts.buttonLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Or copy and paste this link into your browser:</p>
                <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${url}" style="color:${ACCENT};">${url}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #f0f0f0;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">${escapeHtml(opts.footerNote)}</p>
                <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">${BRAND} · Self-hosted WhatsApp automation</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail(resetUrl: string): RenderedEmail {
  return {
    subject: `Reset your ${BRAND} password`,
    html: layout({
      heading: 'Reset your password',
      bodyHtml:
        '<p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>',
      buttonLabel: 'Reset password',
      buttonUrl: resetUrl,
      footerNote:
        "If you didn't request this, you can safely ignore this email — your password will stay the same.",
    }),
    text: `Reset your ${BRAND} password\n\nWe received a request to reset your password. Open the link below to choose a new one. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password will stay the same.`,
  };
}

export function teamInviteEmail(
  inviteUrl: string,
  workspaceName: string,
  roleName: string,
): RenderedEmail {
  const ws = escapeHtml(workspaceName);
  const role = escapeHtml(roleName);
  return {
    subject: `You've been invited to ${workspaceName} on ${BRAND}`,
    html: layout({
      heading: `Join ${ws} on ${BRAND}`,
      bodyHtml: `<p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.6;">You've been invited to join the <strong>${ws}</strong> workspace as <strong>${role}</strong>. Click below to accept and set your password. This invite expires in 7 days.</p>`,
      buttonLabel: 'Accept invite',
      buttonUrl: inviteUrl,
      footerNote:
        "If you weren't expecting this invite, you can ignore this email.",
    }),
    text: `Join ${workspaceName} on ${BRAND}\n\nYou've been invited to join the "${workspaceName}" workspace as ${roleName}. Open the link below to accept and set your password. This invite expires in 7 days.\n\n${inviteUrl}\n\nIf you weren't expecting this invite, ignore this email.`,
  };
}
