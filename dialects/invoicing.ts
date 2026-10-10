import {
  dialect,
  field,
  region,
  button,
  link,
  surface,
  table,
} from "../packages/specdsl-core/src/index.ts";
import { crmSurfaces } from "./crm.ts";
import { dashboardSurfaces } from "./dashboard.ts";
import { pipelineSurfaces } from "./pipeline.ts";
import { shellSurfaces } from "./shell.ts";
import webApp from "./web-app.ts";

export default dialect({
  ...webApp,
  name: "invoicing",
  version: "1",
  surfaces: {
    ...webApp.surfaces,
    ...shellSurfaces,
    ...crmSurfaces,
    ...pipelineSurfaces,
    ...dashboardSurfaces,
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
        "Invoice number": region({ css: "#invoice-number", lv: "#invoice-number" }),
        Status: region({ css: "#invoice-status", lv: "#invoice-status" }),
        Supplier: region({ css: "#invoice-supplier", lv: "#invoice-supplier" }),
        Company: field({
          css: "#invoice-company",
          lv: "invoice[company_id]",
          form: "#invoice-form",
        }),
        "Issue date": field({
          css: "#invoice-issue-date",
          lv: "invoice[issue_date]",
          form: "#invoice-form",
        }),
        "Due date": field({
          css: "#invoice-due-date",
          lv: "invoice[due_date]",
          form: "#invoice-form",
        }),
        "GST rate": field({
          css: "#invoice-gst-rate",
          lv: "invoice[gst_rate]",
          form: "#invoice-form",
        }),
        Prices: field({
          css: "#invoice-prices",
          lv: "invoice[prices]",
          form: "#invoice-form",
        }),
        Notes: field({
          css: "#invoice-notes",
          lv: "invoice[notes]",
          form: "#invoice-form",
        }),
        Lines: table({ css: "#lines", lv: "#lines" }),
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
        "Tax code": field({
          css: "#line-0-tax-code",
          lv: "invoice[lines][0][tax_code]",
          form: "#invoice-form",
        }),
        "Line total": region({ css: "#line-0-total", lv: "#line-0-total" }),
        "Add line": button({ css: "#add-line", lv: "#add-line" }),
        "Remove line": button({ css: "#line-0-remove", lv: "#line-0-remove" }),
        Totals: region({ css: "#totals", lv: "#totals" }),
        Subtotal: region({ css: "#invoice-subtotal", lv: "#invoice-subtotal" }),
        GST: region({ css: "#invoice-gst", lv: "#invoice-gst" }),
        Send: button({ css: "#send-invoice", lv: "#send-invoice" }),
        "Mark paid": button({ css: "#mark-paid-invoice", lv: "#mark-paid-invoice" }),
        Void: button({ css: "#void-invoice", lv: "#void-invoice" }),
        "Company link": link({ css: "#invoice-company-link", lv: "#invoice-company-link" }),
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
