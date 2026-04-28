import { z } from "zod";

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
  message: "must be a hex color (e.g. #1e90ff)",
});

export const ColorsSchema = z
  .object({
    primary: hex.optional(),
    light: hex.optional(),
    dark: hex.optional(),
    background: z
      .union([hex, z.object({ light: hex.optional(), dark: hex.optional() }).strict()])
      .optional(),
    anchors: z
      .union([hex, z.object({ from: hex.optional(), to: hex.optional() }).strict()])
      .optional(),
  })
  .strict();

export type Colors = z.infer<typeof ColorsSchema>;
