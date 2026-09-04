import { z } from "zod";

/**
 * Request-body schemas — Plan.md §7. Validation via Zod.
 */

export const resolveBodySchema = z.object({
  corrected_path_source: z.enum(["MMIT", "Formulary", "Internal"]),
  corrected_path_value: z.string().min(1, "corrected_path_value is required"),
  // Accounts the FRM kept selected in Step 1. Optional for API
  // backwards-compatibility; defaults to every affected account.
  account_ids: z.array(z.string().min(1)).optional(),
});

export const notifyBodySchema = z.object({
  material_ids: z
    .array(z.string().min(1))
    .min(1, "At least one material_id is required"),
  // Only these accounts receive the email. Optional; defaults to every
  // affected account. Must be a subset of the change's affected accounts.
  account_ids: z.array(z.string().min(1)).optional(),
});

export type ResolveBody = z.infer<typeof resolveBodySchema>;
export type NotifyBody = z.infer<typeof notifyBodySchema>;
