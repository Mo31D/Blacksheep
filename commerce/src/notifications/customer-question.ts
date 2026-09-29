import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";
import { EmailSendFailure, sendEmailWithRetry } from "./send-attempt";
import {
  adminOrderUrl,
  escapeEmailHtml,
  renderOwnerOperationalEmail,
} from "./email-template";

export interface CustomerQuestionEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
  ORDER_OWNER_EMAIL?: string;
  ADMIN_BASE_URL?: string;
}

export interface CustomerQuestionNotification {
  orderId: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  body: string;
  messageId: string;
}

export async function notifyOwnerCustomerQuestion(
  env: CustomerQuestionEnv,
  question: CustomerQuestionNotification,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (
    !resolved ||
    !env.DB ||
    !env.ORDER_EMAIL_FROM ||
    !env.ORDER_OWNER_EMAIL
  ) {
    return;
  }

  const orderUrl = adminOrderUrl(
    env.ADMIN_BASE_URL ?? "https://api.theblacksheepshop.co.uk/admin",
    question.reference,
  );
  const message = renderOwnerOperationalEmail({
    preheader: "Customer question · " + question.reference,
    eyebrow: "Customer reply · Action required",
    title: "A customer has a question",
    reference: question.reference,
    intro:
      question.customerName +
      " sent a message from the secure order review page.",
    bodyText:
      "Customer: " +
      question.customerName +
      "\nEmail: " +
      question.customerEmail +
      "\n\n" +
      question.body +
      "\n\nOpen the order in Admin to review the full context before replying.",
    bodyHtml:
      '<div style="border:1px solid #ddd3c3;border-radius:14px;padding:16px 18px;background:#faf6ee;margin:18px 0">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#8a7140;font-weight:800">Customer</div>' +
      '<div style="font-size:17px;font-weight:800;margin-top:4px">' +
      escapeEmailHtml(question.customerName) +
      "</div>" +
      '<div style="font-size:12px;color:#655f56;margin-top:3px">' +
      escapeEmailHtml(question.customerEmail) +
      "</div>" +
      '<div style="border-top:1px solid #ded6c8;margin-top:14px;padding-top:14px;font-size:15px;line-height:1.65;white-space:pre-wrap">' +
      escapeEmailHtml(question.body) +
      "</div></div>",
    cta: { label: "Open order in Admin", url: orderUrl },
    secondaryCta: {
      label: "Reply to customer",
      url: "mailto:" + question.customerEmail,
    },
  });

  let attempts: number;
  try {
    ({ attempts } = await sendEmailWithRetry(resolved.sender, {
      from: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
      to: { email: env.ORDER_OWNER_EMAIL, name: "The Black Sheep Shop" },
      replyTo: {
        email: question.customerEmail,
        name: question.customerName,
      },
        subject: "Customer question · " + question.reference,
      text: message.text,
      html: message.html,
      idempotencyKey: question.messageId,
    }));
  } catch (cause) {
    try {
      await recordOrderEvent(env.DB, {
        orderId: question.orderId,
        eventType: "CUSTOMER_QUESTION_OWNER_EMAIL_FAILED",
        metadata: {
          provider: resolved.provider,
          attempts: cause instanceof EmailSendFailure ? cause.attempts : 1,
          messageId: question.messageId,
          error: "send_failed",
        },
      });
    } catch {
      // The question is already stored; audit failure must not change its response.
    }
    return;
  }
  try {
    await recordOrderEvent(env.DB, {
      orderId: question.orderId,
      eventType: "CUSTOMER_QUESTION_OWNER_EMAIL_SENT",
      metadata: {
        provider: resolved.provider,
        attempts,
        messageId: question.messageId,
      },
    });
  } catch {
    // Do not send again after provider success when only the audit write failed.
  }
}
