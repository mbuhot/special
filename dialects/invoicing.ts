import {
  dialect,
  field,
  region,
  button,
  surface,
  table,
} from "../packages/specdsl-core/src/index.ts";
import { crmSurfaces } from "./crm.ts";
import webApp from "./web-app.ts";

export default dialect({
  ...webApp,
  name: "invoicing",
  version: "1",
  surfaces: {
    ...webApp.surfaces,
    ...crmSurfaces,
    Login: surface({
      route: "/login",
      controls: {
        Email: field({ css: "#login-email", lv: "login[email]", form: "#login-form" }),
        "Log in": button({ css: "#login-submit", lv: "#login-submit" }),
      },
    }),
    "Invoice editor": surface({
      route: "/invoices/{id}/edit",
      controls: {
        Description: field({
          css: "#line-0-description",
          lv: "invoice[lines][0][description]",
          form: "#invoice-form",
        }),
        Quantity: field({
          css: "#line-0-quantity",
          lv: "invoice[lines][0][quantity]",
          form: "#invoice-form",
        }),
        "Unit price": field({
          css: "#line-0-unit-price",
          lv: "invoice[lines][0][unit_price]",
          form: "#invoice-form",
        }),
        Totals: region({ css: "#totals", lv: "#totals" }),
        Status: region({ css: "#invoice-status", lv: "#invoice-status" }),
        Send: button({ css: "#send-invoice", lv: "#send-invoice" }),
        "Mark paid": button({ css: "#mark-paid-invoice", lv: "#mark-paid-invoice" }),
        Void: button({ css: "#void-invoice", lv: "#void-invoice" }),
      },
    }),
    "Invoice list": surface({
      route: "/invoices",
      controls: {
        Invoices: table({ css: "#invoices", lv: "#invoices" }),
        "New invoice": button({ css: "#new-invoice", lv: "#new-invoice" }),
      },
    }),
  },
});
