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
};
