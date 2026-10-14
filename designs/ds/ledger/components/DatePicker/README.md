A date field with a popover calendar showing two months side by side for choosing a day.

Provide: the field's value and, for each month panel, its title and day grid. The grid is data the app supplies: one entry per visible day, in rows of seven starting Monday, each carrying its number and which modifiers apply. The component styles the cells; it computes no dates.

## Parts

- `ds-datepicker`: field wrapper, `position: relative`.
- `ds-datepicker__input`: the text input showing the chosen date (add `ds-input`).
- `ds-datepicker__toggle`: icon button inside the input that opens the popover; give it `aria-label` and `aria-expanded`.
- `ds-datepicker__popover`: the calendar surface, placed under the field; sized for two months and a container for the collapse below.
- `ds-datepicker__months`: a row holding the month panels.
- `ds-datepicker__month`: one month panel: header, weekdays and grid.
- `ds-datepicker__header`: month and year (`ds-datepicker__title`, centred) with `ds-button--icon` buttons at the edges: `ds-datepicker__prev` on the first panel only, `ds-datepicker__next` on the last panel only.
- `ds-datepicker__next--narrow`: a second next button in the first panel, visible only when the popover collapses to one month.
- `ds-datepicker__weekdays` / `ds-datepicker__weekday`: Monday to Sunday labels.
- `ds-datepicker__grid` / `ds-datepicker__day`: seven columns of day buttons.
- `ds-datepicker__footer`: `Today` and `Clear` ghost buttons, below the panels.

## States

Day modifiers: `--outside` (other month, muted), `--today` (ring), `--selected` (accent fill), `--has-items` (dot under the number, for days with tasks or deals), `--disabled` (not selectable). Days show a hover fill and a visible focus outline.

## Usage

- Two months by default: the current month and the next. Previous and next move the view by one month.
- The popover collapses to one month, the first panel, when its width is below `ds-datepicker-two-month-width`; the popover never exceeds the viewport width less a gutter.
- Weeks start on Monday.
- Every day is a `button` with an `aria-label` naming the full date, `data-value="<ISO date>"` and `data-field="<field>"`; a click sets the field and `data-toggles` closes the popover. Today and Clear carry the same attributes (Clear with an empty `data-value`). Mark the chosen day `aria-pressed="true"`.
- Show the popover only while the toggle is open: a closed popover carries `hidden`. Esc or a click outside cancels in the app.
- Use for any date field: task due dates, deal close dates, invoice dates.

## Behaviour

The component script attaches by attribute: `data-ds-popover` on `ds-datepicker` with `data-ds-popover-trigger` on the toggle and `data-ds-popover-panel` on the popover; `data-ds-grid` with `data-ds-grid-columns="7"` on each `ds-datepicker__grid`; `data-ds-grid-cell` on each day. Arrow keys, Home and End move focus between days (roving tabindex), Enter and Space click the focused day, and focus returns to the toggle when the popover is removed or hidden. The script holds no state: Esc or a pointer down outside dispatches `ds:dismiss` on the `data-ds-popover` container, and PageUp or PageDown dispatches `ds:page` on the grid with `detail.direction` of `previous` or `next`; the app listens and decides what closes or which month shows. The preview carries a stand-in for the app that owns the open state, the visible months and the chosen date.
