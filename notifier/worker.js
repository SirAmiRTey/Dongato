import pg from 'pg';
import { Resend } from 'resend';

const { Pool } = pg;

// ==============================================================================
// Configuration & Environment Variables
// ==============================================================================
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/dongato';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'دنگاتو <dongato@noxt.ir>';
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://dongato.noxt.ir').replace(/\/$/, '');
const POLL_INTERVAL_MS = 6000; // 6 seconds

// ==============================================================================
// Clients Initialization
// ==============================================================================
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
});

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
if (!RESEND_API_KEY) {
  console.warn('[Notifier Warning] RESEND_API_KEY is not defined. Email dispatch will fail gracefully and record errors in queue.');
}

// ==============================================================================
// Persian Typography & Currency Formatters
// ==============================================================================
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[+digit]);
}

function formatAmount(amount) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '۰';
  }
  const formattedWithCommas = Number(amount).toLocaleString('en-US');
  return toPersianDigits(formattedWithCommas);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==============================================================================
// Dark-Mode Responsive RTL HTML Email Template Generator
// ==============================================================================
function renderEmailTemplate(job) {
  const { template_type, recipient_name, payload } = job;
  const safeRecipient = escapeHtml(recipient_name || 'هم‌اتاقی');
  const safeRoomName = escapeHtml(payload.room_name || 'اتاق دنگاتو');
  const ctaUrl = payload.room_id ? `${APP_BASE_URL}/?room=${encodeURIComponent(payload.room_id)}` : APP_BASE_URL;

  let subject = 'پیام جدید از دنگاتو';
  let badgeText = 'اطلاعیه دنگاتو';
  let badgeColor = '#10b981'; // Emerald
  let badgeBg = 'rgba(16, 185, 129, 0.15)';
  let headline = '';
  let contentHtml = '';
  let ctaText = 'مشاهده در دنگاتو';

  switch (template_type) {
    case 'NEW_EXPENSE': {
      const expenseTitle = escapeHtml(payload.expense_title || 'هزینه جدید');
      const payerName = escapeHtml(payload.payer_name || 'هم‌اتاقی');
      const totalAmount = formatAmount(payload.total_amount);
      const userShare = formatAmount(payload.user_share);

      subject = `💸 هزینه جدید در ${safeRoomName}: ${expenseTitle}`;
      badgeText = 'ثبت دنگ جدید';
      badgeColor = '#10b981';
      badgeBg = 'rgba(16, 185, 129, 0.15)';
      headline = `${payerName} یک هزینه جدید ثبت کرد`;
      ctaText = 'مشاهده جزئیات هزینه';

      contentHtml = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #0f172a; border-radius: 12px; border: 1px solid #334155; border-collapse: separate;">
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">عنوان هزینه:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; font-weight: 600; text-align: left; border-bottom: 1px solid #1e293b;">${expenseTitle}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">اتاق:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; text-align: left; border-bottom: 1px solid #1e293b;">${safeRoomName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">پرداخت‌کننده:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; text-align: left; border-bottom: 1px solid #1e293b;">${payerName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">کل مبلغ هزینه:</td>
            <td style="padding: 14px 18px; color: #cbd5e1; font-size: 15px; text-align: left; border-bottom: 1px solid #1e293b;">${totalAmount} تومان</td>
          </tr>
          <tr>
            <td style="padding: 16px 18px; color: #10b981; font-size: 15px; font-weight: bold;">سهم دنگ شما:</td>
            <td style="padding: 16px 18px; color: #10b981; font-size: 20px; font-weight: 800; text-align: left;">${userShare} تومان</td>
          </tr>
        </table>
      `;
      break;
    }

    case 'SETTLEMENT_PENDING': {
      const payerName = escapeHtml(payload.payer_name || 'هم‌اتاقی');
      const amount = formatAmount(payload.amount);
      const notes = payload.notes ? escapeHtml(payload.notes) : 'تسویه حساب مستقیم';

      subject = `💳 درخواست تسویه حساب از طرف ${payerName}`;
      badgeText = 'درخواست تسویه حساب';
      badgeColor = '#f43f5e'; // Rose
      badgeBg = 'rgba(244, 63, 94, 0.15)';
      headline = `${payerName} یک پرداخت تسویه حساب ثبت کرد`;
      ctaText = 'بررسی و تایید تسویه';

      contentHtml = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #0f172a; border-radius: 12px; border: 1px solid #334155; border-collapse: separate;">
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">پرداخت‌کننده:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; font-weight: 600; text-align: left; border-bottom: 1px solid #1e293b;">${payerName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">اتاق:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; text-align: left; border-bottom: 1px solid #1e293b;">${safeRoomName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">یادداشت / پیگیری:</td>
            <td style="padding: 14px 18px; color: #cbd5e1; font-size: 14px; text-align: left; border-bottom: 1px solid #1e293b;">${notes}</td>
          </tr>
          <tr>
            <td style="padding: 16px 18px; color: #f43f5e; font-size: 15px; font-weight: bold;">مبلغ واریزی:</td>
            <td style="padding: 16px 18px; color: #f43f5e; font-size: 20px; font-weight: 800; text-align: left;">${amount} تومان</td>
          </tr>
        </table>
        <p style="margin: 12px 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.7;">
          لطفاً پس از اطمینان از واریز مبلغ به حساب بانکی خود، وارد سامانه دنگاتو شده و این تسویه حساب را تایید فرمایید.
        </p>
      `;
      break;
    }

    case 'SETTLEMENT_CONFIRMED': {
      const receiverName = escapeHtml(payload.receiver_name || 'هم‌اتاقی');
      const amount = formatAmount(payload.amount);

      subject = `✅ تسویه حساب شما با ${receiverName} تایید شد`;
      badgeText = 'تسویه تایید شد';
      badgeColor = '#10b981';
      badgeBg = 'rgba(16, 185, 129, 0.15)';
      headline = `تسویه حساب شما با موفقیت تایید گردید`;
      ctaText = 'مشاهده وضعیت اتاق';

      contentHtml = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #0f172a; border-radius: 12px; border: 1px solid #334155; border-collapse: separate;">
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">دریافت‌کننده:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; font-weight: 600; text-align: left; border-bottom: 1px solid #1e293b;">${receiverName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">اتاق:</td>
            <td style="padding: 14px 18px; color: #f8fafc; font-size: 15px; text-align: left; border-bottom: 1px solid #1e293b;">${safeRoomName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; color: #94a3b8; font-size: 14px; border-bottom: 1px solid #1e293b;">وضعیت پرداخت:</td>
            <td style="padding: 14px 18px; color: #10b981; font-size: 15px; font-weight: bold; text-align: left; border-bottom: 1px solid #1e293b;">تایید شده ✅</td>
          </tr>
          <tr>
            <td style="padding: 16px 18px; color: #10b981; font-size: 15px; font-weight: bold;">مبلغ تسویه شده:</td>
            <td style="padding: 16px 18px; color: #10b981; font-size: 20px; font-weight: 800; text-align: left;">${amount} تومان</td>
          </tr>
        </table>
        <p style="margin: 12px 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.7;">
          این تسویه حساب توسط ${receiverName} تایید شد و از مانده بدهی شما کسر گردید.
        </p>
      `;
      break;
    }

    default:
      subject = `اطلاعیه جدید در ${safeRoomName}`;
      headline = 'شما یک اعلان جدید در دنگاتو دارید.';
      contentHtml = `<p style="color: #cbd5e1; font-size: 15px;">برای بررسی جزئیات روی دکمه زیر کلیک نمایید.</p>`;
  }

  const html = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; direction: rtl; text-align: right; color: #f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); direction: rtl; text-align: right;">
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; border-bottom: 1px solid #334155; text-align: center;">
              <div style="font-size: 26px; font-weight: 800; color: #10b981; letter-spacing: -0.5px; margin-bottom: 4px;">
                دنگاتو <span style="font-size: 16px; color: #64748b; font-weight: 400;">| Dongato</span>
              </div>
              <div style="font-size: 13px; color: #94a3b8;">سامانه هوشمند و شفاف مدیریت مخارج گروهی</div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Badge -->
              <div style="display: inline-block; padding: 6px 14px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px;">
                ${badgeText}
              </div>

              <!-- Greeting & Headline -->
              <div style="font-size: 16px; color: #94a3b8; margin-bottom: 8px;">
                سلام ${safeRecipient} عزیز،
              </div>
              <h2 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 16px 0; line-height: 1.5;">
                ${headline}
              </h2>

              <!-- Details Box -->
              ${contentHtml}

              <!-- Call to Action Button -->
              <div style="margin-top: 32px; text-align: center;">
                <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
                  ${ctaText}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px; line-height: 1.8;">
              این ایمیل به صورت خودکار توسط سامانه دنگاتو به آدرس <strong>${escapeHtml(job.recipient_email)}</strong> ارسال شده است.
              <br>
              برای مدیریت و تنظیم اطلاعیه‌ها به پنل دنگاتو مراجعه نمایید.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}

// ==============================================================================
// Outbox Poller & Processor
// ==============================================================================
let isRunning = true;
let isProcessing = false;

async function processQueueBatch() {
  if (isProcessing) return;
  isProcessing = true;

  let client;
  try {
    client = await pool.connect();

    // Atomically select and lock up to 10 pending jobs using FOR UPDATE SKIP LOCKED
    const fetchQuery = `
      UPDATE email_queue
      SET status = 'processing', attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM email_queue
        WHERE status = 'pending' AND attempts < 5
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    const { rows: jobs } = await client.query(fetchQuery);

    if (jobs.length > 0) {
      console.log(`[Notifier] Acquired ${jobs.length} pending email job(s) for dispatch.`);

      for (const job of jobs) {
        try {
          if (!resend) {
            throw new Error('RESEND_API_KEY is missing or invalid in environment.');
          }

          const { subject, html } = renderEmailTemplate(job);

          const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: [job.recipient_email],
            subject: subject,
            html: html,
          });

          if (error) {
            throw new Error(error.message || JSON.stringify(error));
          }

          // Mark job as sent
          await client.query(
            `UPDATE email_queue SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = $1`,
            [job.id]
          );

          console.log(`[Notifier] Job ${job.id} [${job.template_type}] sent successfully to ${job.recipient_email}. (Resend ID: ${data?.id || 'ok'})`);
        } catch (jobError) {
          const errorMessage = jobError?.message || String(jobError);
          console.error(`[Notifier Error] Job ${job.id} failed:`, errorMessage);

          // Update job status to 'failed' with error message
          await client.query(
            `UPDATE email_queue SET status = 'failed', last_error = $2 WHERE id = $1`,
            [job.id, errorMessage]
          );
        }
      }
    }
  } catch (loopError) {
    console.error('[Notifier Loop Error]', loopError.message);
  } finally {
    if (client) {
      client.release();
    }
    isProcessing = false;
  }
}


// ==============================================================================
// Main Polling Loop & Graceful Lifecycle
// ==============================================================================
async function startWorker() {
  console.log('====================================================');
  console.log('🚀 Dongato Outbox Email Notifier Microservice started');
  console.log(`📡 Polling Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`📧 From Address: ${EMAIL_FROM}`);
  console.log(`🌐 App URL: ${APP_BASE_URL}`);
  console.log(`⏱️  Polling Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log('====================================================');

  // Initial immediate check
  await processQueueBatch();

  const intervalId = setInterval(async () => {
    if (!isRunning) return;
    await processQueueBatch();
  }, POLL_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Notifier] Received ${signal}. Shutting down gracefully...`);
    isRunning = false;
    clearInterval(intervalId);

    // Wait for in-flight jobs
    let waitCount = 0;
    while (isProcessing && waitCount < 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      waitCount++;
    }

    try {
      await pool.end();
      console.log('[Notifier] Database connections closed.');
    } catch (err) {
      console.error('[Notifier] Error closing pool:', err.message);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorker().catch((err) => {
  console.error('[Notifier Fatal]', err);
  process.exit(1);
});
