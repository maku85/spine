import type messages from "./messages/it.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
