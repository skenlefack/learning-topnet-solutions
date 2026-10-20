// ============================================================================
// Topnet Solutions Academy — Email Service (Postmark)
// Transactional emails: welcome, password reset, notifications
// ============================================================================
import { ServerClient } from 'postmark';

const POSTMARK_TOKEN = process.env.POSTMARK_API_TOKEN || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@topnet-solutions.com';
const APP_URL = process.env.APP_URL || 'https://learning.topnet-solutions.com';

let client: ServerClient | null = null;

function getClient(): ServerClient | null {
  if (!POSTMARK_TOKEN) {
    console.warn('[email] POSTMARK_API_TOKEN not set — emails disabled');
    return null;
  }
  if (!client) {
    client = new ServerClient(POSTMARK_TOKEN);
  }
  return client;
}

// ---------------------------------------------------------------------------
// HTML template wrapper (Topnet Solutions branding)
// ---------------------------------------------------------------------------

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <!-- Header bar -->
  <tr><td style="height:4px;background:linear-gradient(to right,#1A5632,#C8A951,#930e2d)"></td></tr>
  <!-- Logo -->
  <tr><td style="padding:24px 32px 0;text-align:center">
    <span style="font-size:18px;font-weight:700;color:#930e2d">Topnet Solutions</span>
    <span style="font-size:18px;font-weight:700;color:#1A5632;margin-left:4px">Academy</span>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:24px 32px 32px">${content}</td></tr>
  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #dee2e6;text-align:center">
    <p style="margin:0;font-size:11px;color:#6c757d">
      Topnet Solutions Academy &mdash; Learning Management Platform
    </p>
    <p style="margin:4px 0 0;font-size:11px;color:#adb5bd">
      <a href="${APP_URL}" style="color:#1A5632;text-decoration:none">${APP_URL.replace('https://', '')}</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:#1A5632;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;margin:16px 0">${label}</a>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EmailUser {
  email: string;
  firstName: string;
  lastName?: string;
  preferredLanguage?: string;
}

/**
 * Send a raw email via Postmark.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
): Promise<boolean> {
  const pm = getClient();
  if (!pm) return false;
  try {
    await pm.sendEmail({
      From: EMAIL_FROM,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody || subject,
      MessageStream: 'outbound',
    });
    console.log(`[email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err: any) {
    console.error(`[email] Failed to send to ${to}: ${err.message}`);
    return false;
  }
}

/**
 * Welcome email with temporary password.
 */
export async function sendWelcomeEmail(
  user: EmailUser,
  tempPassword: string,
): Promise<boolean> {
  const lang = user.preferredLanguage || 'fr';
  const isFr = lang === 'fr';

  const subject = isFr
    ? 'Bienvenue sur Topnet Solutions Academy'
    : 'Welcome to Topnet Solutions Academy';

  const html = wrapHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#212529">
      ${isFr ? `Bienvenue, ${user.firstName} !` : `Welcome, ${user.firstName}!`}
    </h2>
    <p style="font-size:14px;color:#495057;line-height:1.6">
      ${isFr
        ? 'Votre compte a été créé sur la plateforme de formation Topnet Solutions Academy. Voici vos identifiants de connexion :'
        : 'Your account has been created on the Topnet Solutions Academy training platform. Here are your login credentials:'}
    </p>
    <table style="margin:16px 0;background:#f8f9fa;border-radius:8px;padding:16px;width:100%">
      <tr><td style="padding:8px 16px;font-size:13px;color:#6c757d">${isFr ? 'Email' : 'Email'}</td>
          <td style="padding:8px 16px;font-size:14px;font-weight:600;color:#212529">${user.email}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#6c757d">${isFr ? 'Mot de passe temporaire' : 'Temporary password'}</td>
          <td style="padding:8px 16px;font-size:14px;font-weight:600;color:#212529;font-family:monospace">${tempPassword}</td></tr>
    </table>
    <p style="font-size:13px;color:#6c757d">
      ${isFr
        ? 'Nous vous recommandons de changer votre mot de passe après votre première connexion.'
        : 'We recommend changing your password after your first login.'}
    </p>
    <div style="text-align:center">
      ${btn(`${APP_URL}/login`, isFr ? 'Se connecter' : 'Log in')}
    </div>
  `);

  return sendEmail(user.email, subject, html);
}

/**
 * Password reset email with token link.
 */
export async function sendPasswordResetEmail(
  user: EmailUser,
  resetToken: string,
): Promise<boolean> {
  const lang = user.preferredLanguage || 'fr';
  const isFr = lang === 'fr';
  const resetUrl = `${APP_URL}/login?reset=${resetToken}`;

  const subject = isFr
    ? 'Réinitialisez votre mot de passe — Topnet Solutions Academy'
    : 'Reset your password — Topnet Solutions Academy';

  const html = wrapHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#212529">
      ${isFr ? 'Réinitialisation du mot de passe' : 'Password Reset'}
    </h2>
    <p style="font-size:14px;color:#495057;line-height:1.6">
      ${isFr
        ? `Bonjour ${user.firstName}, vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :`
        : `Hello ${user.firstName}, you requested a password reset. Click the button below to choose a new one:`}
    </p>
    <div style="text-align:center">
      ${btn(resetUrl, isFr ? 'Réinitialiser mon mot de passe' : 'Reset my password')}
    </div>
    <p style="font-size:12px;color:#6c757d;margin-top:16px">
      ${isFr
        ? 'Ce lien expire dans 1 heure. Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email.'
        : 'This link expires in 1 hour. If you did not request this reset, ignore this email.'}
    </p>
    <p style="font-size:11px;color:#adb5bd;word-break:break-all">${resetUrl}</p>
  `);

  return sendEmail(user.email, subject, html);
}

/**
 * Password changed confirmation email.
 */
export async function sendPasswordChangedEmail(
  user: EmailUser,
): Promise<boolean> {
  const lang = user.preferredLanguage || 'fr';
  const isFr = lang === 'fr';

  const subject = isFr
    ? 'Mot de passe modifié — Topnet Solutions Academy'
    : 'Password changed — Topnet Solutions Academy';

  const html = wrapHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#212529">
      ${isFr ? 'Mot de passe modifié' : 'Password Changed'}
    </h2>
    <p style="font-size:14px;color:#495057;line-height:1.6">
      ${isFr
        ? `Bonjour ${user.firstName}, votre mot de passe a été modifié avec succès. Si vous n'êtes pas à l'origine de cette action, contactez immédiatement l'administrateur.`
        : `Hello ${user.firstName}, your password has been changed successfully. If you did not make this change, contact the administrator immediately.`}
    </p>
    <div style="text-align:center">
      ${btn(`${APP_URL}/login`, isFr ? 'Se connecter' : 'Log in')}
    </div>
  `);

  return sendEmail(user.email, subject, html);
}

/**
 * Generic notification email (enrollment, certification, completion, etc.)
 */
export async function sendNotificationEmail(
  user: EmailUser,
  title: string,
  body: string,
  ctaUrl?: string,
  ctaLabel?: string,
): Promise<boolean> {
  const lang = user.preferredLanguage || 'fr';
  const isFr = lang === 'fr';

  const html = wrapHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#212529">${title}</h2>
    <p style="font-size:14px;color:#495057;line-height:1.6">${body}</p>
    ${ctaUrl ? `<div style="text-align:center">${btn(ctaUrl, ctaLabel || (isFr ? 'Accéder à la plateforme' : 'Go to platform'))}</div>` : ''}
  `);

  return sendEmail(user.email, title, html);
}
