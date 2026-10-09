import { link, region, surface } from "../packages/specdsl-core/src/index.ts";

export const shellSurfaces = {
  Sidebar: surface({
    shared: true,
    controls: {
      Dashboard: link({ css: "#nav-dashboard", lv: "#nav-dashboard" }),
      Contacts: link({ css: "#nav-contacts", lv: "#nav-contacts" }),
      Companies: link({ css: "#nav-companies", lv: "#nav-companies" }),
      Pipeline: link({ css: "#nav-pipeline", lv: "#nav-pipeline" }),
      Invoices: link({ css: "#nav-invoices", lv: "#nav-invoices" }),
      "Signed in as": region({ css: "#signed-in-as", lv: "#signed-in-as" }),
    },
  }),
};
