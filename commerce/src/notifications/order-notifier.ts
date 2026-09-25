import type {
  CreatedOrder,
  SubmittedOrderInput,
} from "../domain/order";

export interface OrderNotificationContext {
  order: CreatedOrder;
  request: SubmittedOrderInput;
}

export interface OrderNotifier {
  notifyOwner(context: OrderNotificationContext): Promise<unknown>;
  acknowledgeCustomer(context: OrderNotificationContext): Promise<unknown>;
}

export interface SendEmailBindingLike {
  send(message: {
    from: string | { email: string; name?: string };
    to: string | { email: string; name?: string };
    replyTo?: string | { email: string; name?: string };
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}
