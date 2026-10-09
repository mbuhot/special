import { region, surface } from "../packages/specdsl-core/src/index.ts";

export const dashboardSurfaces = {
  Dashboard: surface({
    route: "/dashboard",
    controls: {
      "Open deals by stage": region({
        css: "#open-deals-by-stage",
        lv: "#open-deals-by-stage",
      }),
      "Overdue tasks": region({ css: "#overdue-tasks-count", lv: "#overdue-tasks-count" }),
      "Unpaid invoices": region({
        css: "#unpaid-invoices-count",
        lv: "#unpaid-invoices-count",
      }),
    },
  }),
};
