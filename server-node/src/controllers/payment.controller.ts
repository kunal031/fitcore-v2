/** Payment HTTP handlers. */
import type { Request, Response } from "express";

import type {
  InitiatePaymentInput,
  ManualPaymentInput,
  VerifyPaymentInput,
} from "../dtos/payment.dto.js";
import { asyncHandler, currentUser } from "../middleware/index.js";
import { paymentService } from "../services/index.js";
import { success } from "../utils/apiResponse.js";

export const paymentController = {
  /** POST /payments/initiate — prices the plan and opens a gateway order. Member only. */
  initiate: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.initiateCheckout(
      currentUser(req),
      req.body as InitiatePaymentInput,
    );
    res.json(success(data, "Payment initiated."));
  }),

  /** POST /payments/verify — confirms payment and activates the plan. Member only. */
  verify: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.verifyPayment(
      currentUser(req),
      req.body as VerifyPaymentInput,
    );
    res.json(
      success(data, "Payment verified and subscription activated successfully!"),
    );
  }),

  /** POST /payments/manual — 201. Cash/UPI taken at the desk. Staff only. */
  recordManual: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.recordManualPayment(
      currentUser(req),
      req.body as ManualPaymentInput,
    );
    res
      .status(201)
      .json(success(data, "Manual payment recorded and plan activated."));
  }),

  /** GET /payments/me — registered before any param route. Member only. */
  getMyPayments: asyncHandler(async (req: Request, res: Response) => {
    const data = await paymentService.getMyPayments(String(currentUser(req)._id));
    res.json(success(data));
  }),

  /** GET /payments — all payments. Owner only. */
  listAll: asyncHandler(async (_req: Request, res: Response) => {
    res.json(success(await paymentService.listAllPayments()));
  }),
};
