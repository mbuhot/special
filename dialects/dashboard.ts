import { link, region, surface } from "../packages/specdsl-core/src/index.ts";

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
      "Recent activity": region({ css: "#recent-activity", lv: "#recent-activity" }),
      "View pipeline": link({ css: "#view-pipeline", lv: "#view-pipeline" }),
      "View invoices": link({ css: "#view-invoices", lv: "#view-invoices" }),
      "View tasks": link({ css: "#view-tasks", lv: "#view-tasks" }),
    },
  }),
};
