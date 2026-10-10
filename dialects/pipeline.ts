import { button, field, link, region, surface, table } from "../packages/specdsl-core/src/index.ts";

export const pipelineSurfaces = {
  "Pipeline board": surface({
    route: "/pipeline",
    controls: {
      "Lead column": region({ css: "#column-lead", lv: "#column-lead" }),
      "Qualified column": region({ css: "#column-qualified", lv: "#column-qualified" }),
      "Proposal column": region({ css: "#column-proposal", lv: "#column-proposal" }),
      "Won column": region({ css: "#column-won", lv: "#column-won" }),
      "Lost column": region({ css: "#column-lost", lv: "#column-lost" }),
      Stage: field({
        css: "select[data-deal-stage]",
        lv: "deal[stage]",
        form: "form[data-deal-stage]",
      }),
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
      Cancel: link({ css: "#cancel-deal", lv: "#cancel-deal" }),
      "Deal name": region({ css: "#deal-name", lv: "#deal-name" }),
      Stage: region({ css: "#deal-stage", lv: "#deal-stage" }),
    },
  }),
  "Deal page": surface({
    route: "/deals/{id}",
    controls: {
      "Deal name": region({ css: "#deal-name", lv: "#deal-name" }),
      Properties: region({ css: "#deal-properties", lv: "#deal-properties" }),
      Stage: region({ css: "#deal-stage", lv: "#deal-stage" }),
      Qualify: button({ css: "#deal-qualify", lv: "#deal-qualify" }),
      Propose: button({ css: "#deal-propose", lv: "#deal-propose" }),
      Win: button({ css: "#deal-win", lv: "#deal-win" }),
      Lose: button({ css: "#deal-lose", lv: "#deal-lose" }),
      "Company link": link({ css: "#deal-company-link", lv: "#deal-company-link" }),
      "Contact link": link({ css: "#deal-contact-link", lv: "#deal-contact-link" }),
      Tasks: table({ css: "#tasks", lv: "#tasks" }),
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
      "Overdue badge": region({ css: "span[data-overdue-badge]", lv: "span[data-overdue-badge]" }),
      "View all my tasks": link({ css: "#view-all-my-tasks", lv: "#view-all-my-tasks" }),
    },
  }),
  "Task list": surface({
    route: "/tasks",
    controls: {
      "My tasks": table({ css: "#task-list-table", lv: "#task-list-table" }),
      "Task filter": field({
        css: "#task-list-filter",
        lv: "filter[show]",
        form: "#task-list-filter-form",
      }),
      "New task title": field({
        css: "#task-list-new-title",
        lv: "task[title]",
        form: "#task-list-new-form",
      }),
      "New task due date": field({
        css: "#task-list-new-due-date",
        lv: "task[due_date]",
        form: "#task-list-new-form",
      }),
      "New task deal": field({
        css: "#task-list-new-deal",
        lv: "task[deal_id]",
        form: "#task-list-new-form",
      }),
      "New task assignee": field({
        css: "#task-list-new-assignee",
        lv: "task[assignee_id]",
        form: "#task-list-new-form",
      }),
      "Add task": button({ css: "#task-list-add", lv: "#task-list-add" }),
      "Select all tasks": button({ css: "#task-list-select-all", lv: "#task-list-select-all" }),
      "Select task": button({
        css: "input[data-select-task]",
        lv: "input[data-select-task]",
      }),
      "Bulk actions": region({ css: "#task-list-bulk", lv: "#task-list-bulk" }),
      "Bulk assignee": field({
        css: "#task-list-bulk-assignee",
        lv: "bulk[assignee_id]",
        form: "#task-list-bulk-form",
      }),
      "Reassign selected": button({
        css: "#task-list-bulk-reassign",
        lv: "#task-list-bulk-reassign",
      }),
      "Complete selected": button({
        css: "#task-list-bulk-complete",
        lv: "#task-list-bulk-complete",
      }),
      "Clear selection": button({
        css: "#task-list-clear-selection",
        lv: "#task-list-clear-selection",
      }),
      "Deal link": link({ css: "a[data-task-deal]", lv: "a[data-task-deal]" }),
      "Complete task": button({
        css: "button[data-complete-task]",
        lv: "button[data-complete-task]",
      }),
      "Task actions": button({
        css: "button[data-task-actions]",
        lv: "button[data-task-actions]",
      }),
      "Open deal": link({ css: "a[data-task-open-deal]", lv: "a[data-task-open-deal]" }),
      "Reassign task": button({
        css: "button[data-task-reassign-open]",
        lv: "button[data-task-reassign-open]",
      }),
      Assignee: field({
        css: "select[data-task-assignee]",
        lv: "task[assignee_id]",
        form: "form[data-task-reassign]",
      }),
      "Cancel reassign": button({
        css: "button[data-task-reassign-cancel]",
        lv: "button[data-task-reassign-cancel]",
      }),
      Reassign: button({
        css: "button[data-task-reassign]",
        lv: "button[data-task-reassign]",
      }),
    },
  }),
};
