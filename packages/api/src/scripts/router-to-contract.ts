import "dotenv/config";
import { writeFileSync } from "node:fs";

import { minifyContractRouter } from "@orpc/contract";
import { unlazyRouter } from "@orpc/server";

import router from "../router";

const resolved = await unlazyRouter(router);

const minified = minifyContractRouter(resolved);

writeFileSync("./src/contract.json", JSON.stringify(minified, null, 2));

console.log("✅ Contract exported to ./src/contract.json");
