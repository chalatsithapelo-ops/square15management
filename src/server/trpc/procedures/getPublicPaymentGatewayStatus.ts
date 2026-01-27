import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";

export const getPublicPaymentGatewayStatus = baseProcedure.query(() => {
  const payfastConfigured = Boolean(env.PAYFAST_MERCHANT_ID && env.PAYFAST_MERCHANT_KEY);

  return {
    payfast: {
      configured: payfastConfigured,
      sandbox: Boolean(env.PAYFAST_SANDBOX),
    },
  };
});
