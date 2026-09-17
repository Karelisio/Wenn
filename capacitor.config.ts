import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.karelisio.wenn",
  appName: "Wenn",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_wenn",
      iconColor: "#E0577E",
    },
  },
};

export default config;
