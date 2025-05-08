import "dotenv/config";
import config from "../benchmark-config.json";

export function getConfig() {
  return {
    providers: config.providers,
    tinybird: {
      userToken: process.env.USER_TOKEN!,
      userId: process.env.USER_ID!,

      explorationId: process.env.EXPLORATION_ID!,
      explorationName: process.env.EXPLORATION_NAME!,
      
      apiHost: process.env.TINYBIRD_API_HOST!,
      chatApiEndpoint: process.env.CHAT_API_ENDPOINT!,

      workspaceId: process.env.TINYBIRD_WORKSPACE_ID!,
      workspaceToken: process.env.TINYBIRD_WORKSPACE_TOKEN!,
      
    },
  };
}
