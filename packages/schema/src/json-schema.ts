import { z } from "zod";
import { DocsJsonSchema } from "./docs-json.js";

export function generateDocsJsonSchema() {
  return z.toJSONSchema(DocsJsonSchema);
}
