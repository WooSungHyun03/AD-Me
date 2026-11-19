import { parseConfig } from "../src/lib/config-schema.ts";

console.log(JSON.stringify(parseConfig(process.env).diagnostics, null, 2));
