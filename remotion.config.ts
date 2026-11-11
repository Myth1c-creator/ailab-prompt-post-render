import { Config } from "@remotion/cli/config";
import fs from "fs";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");
// PC uživatele: lokální Chromium + angle-egl (viz src/fx/README.md). GitHub Actions: Remotion Chromium + swangle.
const local =
  "C:/Users/ONDRA/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe";
if (fs.existsSync(local)) {
  Config.setBrowserExecutable(local);
  Config.setChromiumOpenGlRenderer("angle-egl");
  Config.setConcurrency(1);
} else {
  Config.setChromiumOpenGlRenderer("swangle");
}
