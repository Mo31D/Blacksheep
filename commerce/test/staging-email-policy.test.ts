import { describe, expect, it, vi } from "vitest";
import {
  EmailRecipientPolicyError,
  resolveEmailSender,
} from "../src/notifications/email-provider";
import { sendEmailWithRetry } from "../src/notifications/send-attempt";

const message = {
  from: "shop@example.com",
  to: { email: "qa@example.test", name: "QA" },
  subject: "Order update",
  text: "Update",
  html: "<p>Update</p>",
};

describe("staging email recipient policy", () => {
  it("blocks every recipient by default before calling the provider", async () => {
    const send = vi.fn(async () => ({ id: "sent" }));
    const resolved = resolveEmailSender({ ENVIRONMENT: "staging", EMAIL: { send } })!;

    await expect(sendEmailWithRetry(resolved.sender, message)).rejects.toMatchObject({
      attempts: 1,
      cause: expect.any(EmailRecipientPolicyError),
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends only to exact approved mailboxes, regardless of address case", async () => {
    const send = vi.fn(async () => ({ id: "sent" }));
    const resolved = resolveEmailSender({
      ENVIRONMENT: "staging",
      STAGING_EMAIL_ALLOWLIST: " QA@EXAMPLE.TEST ",
      EMAIL: { send },
    })!;

    await expect(sendEmailWithRetry(resolved.sender, message)).resolves.toMatchObject({ attempts: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    await expect(resolved.sender.send({ ...message, to: "customer@example.test" })).rejects.toBeInstanceOf(EmailRecipientPolicyError);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("fails closed for malformed or wildcard allowlists", async () => {
    const send = vi.fn(async () => ({ id: "sent" }));
    for (const value of ["*", "qa@example.test,*", "example.test", ""]) {
      const resolved = resolveEmailSender({
        ENVIRONMENT: "staging", STAGING_EMAIL_ALLOWLIST: value, EMAIL: { send },
      })!;
      await expect(resolved.sender.send(message)).rejects.toBeInstanceOf(EmailRecipientPolicyError);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("applies the guard to Resend and preview, but leaves production sends unchanged", async () => {
    const resend = resolveEmailSender({ ENVIRONMENT: "preview", RESEND_API_KEY: "re_test_key" })!;
    await expect(resend.sender.send(message)).rejects.toBeInstanceOf(EmailRecipientPolicyError);

    const send = vi.fn(async () => ({ id: "sent" }));
    const production = resolveEmailSender({ ENVIRONMENT: "production", EMAIL: { send } })!;
    await production.sender.send(message);
    expect(send).toHaveBeenCalledOnce();
  });
});
