import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    PRINTER_PASSWORD: z.string(),
    PRINTER_IP: z.string(),
    PRINTER_PORT: z.string(),
    PRINTER_BASE_URL: z.string(),
    PRINTER_NAME: z.string(),
    SCAN_TEMP_DIR_NAME: z.string(),
    SCAN_TEMP_PREVIEW_DIR_NAME: z.string(),
    SCANNER_ESCL: z.string(),
    PRINTER_IPP: z.string(),
  },
  experimental__runtimeEnv: process.env,
});
