import { button, link, region, surface } from "../packages/specdsl-core/src/index.ts";

export const shellSurfaces = {
  Sidebar: surface({
    shared: true,
    controls: {
      Dashboard: link({ css: "#nav-dashboard", lv: "#nav-dashboard" }),
      Contacts: link({ css: "#nav-contacts", lv: "#nav-contacts" }),
      Companies: link({ css: "#nav-companies", lv: "#nav-companies" }),
      Pipeline: link({ css: "#nav-pipeline", lv: "#nav-pipeline" }),
      "My tasks": link({ css: "#nav-my-tasks", lv: "#nav-my-tasks" }),
      Invoices: link({ css: "#nav-invoices", lv: "#nav-invoices" }),
      "Signed in as": region({ css: "#signed-in-as", lv: "#signed-in-as" }),
      "Sign out": button({ css: "#sign-out", lv: "#sign-out" }),
    },
  }),
};
