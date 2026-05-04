import "dotenv/config";
import config from "../benchmark-config.json";

export function getConfig() {
  return {
    providers: config.providers,
    tinybird: {
      apiHost: process.env.TINYBIRD_API_HOST!,
      workspaceToken: process.env.TINYBIRD_WORKSPACE_TOKEN!,
    },
  };
}
