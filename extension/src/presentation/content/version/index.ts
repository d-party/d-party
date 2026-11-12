import { versionCheck } from "@/infrastructure/api/generated/d-party";

/** Lobby pages: writes whether this version is supported into `.chrome_extension_field`. */

async function run(): Promise<void> {
  const field = document.getElementsByClassName(
    "chrome_extension_field",
  )[0] as HTMLElement | undefined;

  const version = chrome.runtime.getManifest().version;
  let isPossible = false;
  try {
    const response = await versionCheck({ "extension-version": version });
    if (response.status === 200) {
      isPossible = response.data.is_possible;
    }
  } catch {
    isPossible = false;
  }

  if (field) field.innerText = String(isPossible);
}

void run();
