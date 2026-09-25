import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";
import {
  escapeEmailHtml,
  renderTransactionalEmail,
} from "./email-template";

export interface CustomerQuestionEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
  ORDER_OWNER_EMAIL?: string;
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

  const message = renderTransactionalEmail({
    preheader: "Customer question · " + question.reference,
    eyebrow: "Customer question",
    title: "A customer has a question about a reviewed order",
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
      question.body,
    bodyHtml:
      '<div style="border:1px solid #ded6c8;border-radius:14px;padding:16px 18px;background:#f8f4eb;margin:18px 0">' +
      '<div style="font-size:13px;color:#756f64">Customer</div>' +
      '<div style="font-size:16px;font-weight:700;margin-top:3px">' +
      escapeEmailHtml(question.customerName) +
      "</div>" +
      '<div style="font-size:13px;color:#655f56;margin-top:3px">' +
      escapeEmailHtml(question.customerEmail) +
      "</div>" +
      '<div style="border-top:1px solid #ded6c8;margin-top:14px;padding-top:14px;font-size:15px;line-height:1.65;white-space:pre-wrap">' +
      escapeEmailHtml(question.body) +
      "</div></div>",
  });

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      await resolved.sender.send({
        from: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
        to: { email: env.ORDER_OWNER_EMAIL, name: "The Black Sheep Shop" },
        replyTo: {
          email: question.customerEmail,
          name: question.customerName,
        },
        subject: "Customer question · " + question.reference,
        text: message.text,
        html: message.html,
      });
      await recordOrderEvent(env.DB, {
        orderId: question.orderId,
        eventType: "CUSTOMER_QUESTION_OWNER_EMAIL_SENT",
        metadata: {
          provider: resolved.provider,
          attempts: attemptNumber,
          messageId: question.messageId,
        },
      });
      return;
    } catch {
      if (attemptNumber === 2) {
        await recordOrderEvent(env.DB, {
          orderId: question.orderId,
          eventType: "CUSTOMER_QUESTION_OWNER_EMAIL_FAILED",
          metadata: {
            provider: resolved.provider,
            attempts: attemptNumber,
            messageId: question.messageId,
            error: "send_failed",
          },
        });
      }
    }
  }
}
