import { button, field, region, surface, table } from "../packages/specdsl-core/src/index.ts";

const transitionButton = (transition: string) =>
  button({
    css: `button[data-transition='${transition}']`,
    lv: `button[data-transition='${transition}']`,
  });

export const pipelineSurfaces = {
  "Pipeline board": surface({
    route: "/pipeline",
    controls: {
      "Lead column": region({ css: "#column-lead", lv: "#column-lead" }),
      "Qualified column": region({ css: "#column-qualified", lv: "#column-qualified" }),
      "Proposal column": region({ css: "#column-proposal", lv: "#column-proposal" }),
      "Won column": region({ css: "#column-won", lv: "#column-won" }),
      "Lost column": region({ css: "#column-lost", lv: "#column-lost" }),
      Qualify: transitionButton("qualify"),
      Propose: transitionButton("propose"),
      Win: transitionButton("win"),
      Lose: transitionButton("lose"),
      "New deal": button({ css: "#new-deal", lv: "#new-deal" }),
    },
  }),
  "Deal editor": surface({
    route: "/deals/{id}/edit",
    controls: {
      Name: field({ css: "#deal-name-input", lv: "deal[name]", form: "#deal-form" }),
      Amount: field({ css: "#deal-amount", lv: "deal[amount]", form: "#deal-form" }),
      "Close date": field({
        css: "#deal-close-date",
        lv: "deal[close_date]",
        form: "#deal-form",
      }),
      Company: field({ css: "#deal-company", lv: "deal[company_id]", form: "#deal-form" }),
      Contact: field({ css: "#deal-contact", lv: "deal[contact_id]", form: "#deal-form" }),
      Save: button({ css: "#save-deal", lv: "#save-deal" }),
      "Deal name": region({ css: "#deal-name", lv: "#deal-name" }),
      Stage: region({ css: "#deal-stage", lv: "#deal-stage" }),
    },
  }),
  "Deal page": surface({
    route: "/deals/{id}",
    controls: {
      "Deal name": region({ css: "#deal-name", lv: "#deal-name" }),
      Stage: region({ css: "#deal-stage", lv: "#deal-stage" }),
      Tasks: table({ css: "#tasks", lv: "#tasks" }),
      "Overdue tasks": region({ css: "#overdue-tasks", lv: "#overdue-tasks" }),
      "Task title": field({ css: "#task-title", lv: "task[title]", form: "#task-form" }),
      "Task due date": field({
        css: "#task-due-date",
        lv: "task[due_date]",
        form: "#task-form",
      }),
      "Add task": button({ css: "#add-task", lv: "#add-task" }),
      "Complete task": button({
        css: "button[data-complete-task]",
        lv: "button[data-complete-task]",
      }),
    },
  }),
};
