import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const specsDirectory = join(repositoryRoot, "specs");
export const dialectsDirectory = join(repositoryRoot, "dialects");
export const ttsCacheDirectory = join(repositoryRoot, ".tts-cache");
export const demoOutputDirectory = join(repositoryRoot, "demo-output");
export const designsDirectory = join(repositoryRoot, "designs");
export const designOutputDirectory = join(repositoryRoot, "design-output");
