/**
 * Razorpay gateway adapter.
 *
 * The Python server ships with Razorpay mocked, and this keeps that: when the
 * configured key is the `.env.example` placeholder, orders get a synthetic id
 * and signatures are not checked. Supplying real credentials switches both on.
 *
 * Order creation is a plain REST call rather than the SDK, so the mocked and
 * live paths differ only in whether the request is made.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { settings } from "../config/env.js";
import { PaymentError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

export interface CreateOrderParams {
  amountPaise: number;
  receipt: string;
  currency?: string;
}

export const razorpayService = {
  /** True when the gateway is running in mock mode. */
  get isMocked(): boolean {
    return settings.isRazorpayMocked;
  },

  /**
   * Create a gateway order and return its id.
   *
   * In mock mode this returns `order_mock_<receipt>` without any network call,
   * which is what lets the frontend's mock checkout work offline.
   */
  async createOrder(params: CreateOrderParams): Promise<string> {
    const mockOrderId = `order_mock_${params.receipt}`;
    if (this.isMocked) return mockOrderId;

    const credentials = Buffer.from(
      `${settings.RAZORPAY_KEY_ID}:${settings.RAZORPAY_KEY_SECRET}`,
    ).toString("base64");

    try {
      const response = await fetch(RAZORPAY_ORDERS_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amountPaise,
          currency: params.currency ?? "INR",
          receipt: params.receipt,
          payment_capture: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Razorpay responded ${response.status}`);
      }

      const order = (await response.json()) as { id?: string };
      return order.id ?? mockOrderId;
    } catch (error) {
      logger.error({ err: error }, "Razorpay order creation failed");
      throw new PaymentError("Could not initiate gateway order. Please retry.");
    }
  },

  /**
   * Verify the HMAC-SHA256 signature Razorpay returns with a payment.
   *
   * Always true in mock mode. Compared in constant time so a mismatch cannot
   * be located byte by byte.
   */
  verifySignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    if (this.isMocked) return true;

    const expected = createHmac("sha256", settings.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  },
};
