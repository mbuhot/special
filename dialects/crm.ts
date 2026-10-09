import { button, field, region, surface, table } from "../packages/specdsl-core/src/index.ts";

export const crmSurfaces = {
  "Contact list": surface({
    route: "/contacts",
    controls: {
      Search: field({
        css: "#contact-search",
        lv: "filter[search]",
        form: "#contact-filter-form",
      }),
      "Company filter": field({
        css: "#contact-company-filter",
        lv: "filter[company]",
        form: "#contact-filter-form",
      }),
      Contacts: table({ css: "#contacts", lv: "#contacts" }),
      "New contact": button({ css: "#new-contact", lv: "#new-contact" }),
    },
  }),
  "Contact editor": surface({
    route: "/contacts/{id}/edit",
    controls: {
      "First name": field({
        css: "#contact-first-name",
        lv: "contact[first_name]",
        form: "#contact-form",
      }),
      "Last name": field({
        css: "#contact-last-name",
        lv: "contact[last_name]",
        form: "#contact-form",
      }),
      Email: field({ css: "#contact-email", lv: "contact[email]", form: "#contact-form" }),
      Phone: field({ css: "#contact-phone", lv: "contact[phone]", form: "#contact-form" }),
      Company: field({
        css: "#contact-company",
        lv: "contact[company_id]",
        form: "#contact-form",
      }),
      Save: button({ css: "#save-contact", lv: "#save-contact" }),
      "Contact name": region({ css: "#contact-name", lv: "#contact-name" }),
    },
  }),
  "Company list": surface({
    route: "/companies",
    controls: {
      Search: field({
        css: "#company-search",
        lv: "filter[search]",
        form: "#company-filter-form",
      }),
      Companies: table({ css: "#companies", lv: "#companies" }),
      "New company": button({ css: "#new-company", lv: "#new-company" }),
    },
  }),
  "Company editor": surface({
    route: "/companies/{id}/edit",
    controls: {
      Name: field({ css: "#company-name-input", lv: "company[name]", form: "#company-form" }),
      Domain: field({ css: "#company-domain", lv: "company[domain]", form: "#company-form" }),
      Industry: field({
        css: "#company-industry",
        lv: "company[industry]",
        form: "#company-form",
      }),
      Save: button({ css: "#save-company", lv: "#save-company" }),
      "Company name": region({ css: "#company-name", lv: "#company-name" }),
    },
  }),
  "Company page": surface({
    route: "/companies/{id}",
    controls: {
      "Company name": region({ css: "#company-name", lv: "#company-name" }),
      "Company contacts": table({ css: "#company-contacts", lv: "#company-contacts" }),
      "Edit company": button({ css: "#edit-company", lv: "#edit-company" }),
    },
  }),
  "Contact page": surface({
    route: "/contacts/{id}",
    controls: {
      "Contact name": region({ css: "#contact-name", lv: "#contact-name" }),
      Timeline: region({ css: "#timeline", lv: "#timeline" }),
      "Activity kind": field({
        css: "#activity-kind",
        lv: "activity[kind]",
        form: "#activity-form",
      }),
      "Activity body": field({
        css: "#activity-body",
        lv: "activity[body]",
        form: "#activity-form",
      }),
      "Log activity": button({ css: "#log-activity", lv: "#log-activity" }),
    },
  }),
};
