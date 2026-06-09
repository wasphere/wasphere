import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { passwordResetEmail, teamInviteEmail } from './templates';

/**
 * SMTP email delivery via nodemailer.
 *
 * Email is OPTIONAL: if SMTP_HOST is unset the service is disabled and every
 * send becomes a logged no-op, so self-hosted deploys without SMTP still boot
 * and behave exactly as before. When configured, transactional emails
 * (password reset, team invite) are delivered.
 *
 * Sends never throw to the caller — a delivery failure is logged and reported
 * via the boolean return, so callers can keep enumeration-safe responses.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private initialized = false;

  /** Where the dashboard UI is reachable — used to build links in emails. */
  private get uiBaseUrl(): string {
    return (process.env.DASHBOARD_UI_URL ?? '').replace(/\/+$/, '');
  }

  private get from(): string {
    return process.env.SMTP_FROM ?? 'WaSphere <no-reply@localhost>';
  }

  get isEnabled(): boolean {
    return !!process.env.SMTP_HOST;
  }

  /** Lazily build the transporter on first use. */
  private getTransporter(): Transporter | null {
    if (this.initialized) return this.transporter;
    this.initialized = true;

    if (!this.isEnabled) {
      this.logger.warn(
        'SMTP_HOST is not set — email delivery is DISABLED. Password-reset and invite emails will not be sent.',
      );
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER || process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    this.logger.log(
      `SMTP email delivery enabled (host=${process.env.SMTP_HOST}).`,
    );
    return this.transporter;
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.sendMail({ from: this.from, to, subject, html, text });
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send "${subject}" to ${to}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<boolean> {
    const base = this.uiBaseUrl;
    if (!base) {
      // No public UI URL → the link would be relative and useless in a mail
      // client. Don't send a broken email; the misconfig is logged at boot.
      this.logger.error(
        'Cannot send password-reset email: DASHBOARD_UI_URL is not set (the reset link would be broken).',
      );
      return false;
    }
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const { subject, html, text } = passwordResetEmail(resetUrl);
    return this.send(to, subject, html, text);
  }

  async sendTeamInviteEmail(
    to: string,
    inviteUrl: string,
    workspaceName: string,
    roleName: string,
  ): Promise<boolean> {
    if (!/^https?:\/\//i.test(inviteUrl)) {
      this.logger.error(
        'Cannot send invite email: invite URL is not absolute (set DASHBOARD_UI_URL).',
      );
      return false;
    }
    const { subject, html, text } = teamInviteEmail(
      inviteUrl,
      workspaceName,
      roleName,
    );
    return this.send(to, subject, html, text);
  }
}
