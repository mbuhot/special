A date field with a popover month calendar for choosing a day.

Provide: the field's value, the month title, and the day grid. The grid is data the app supplies: one entry per visible day, in rows of seven starting Monday, each carrying its number and which modifiers apply. The component styles the cells; it computes no dates.

## Parts

- `ds-datepicker`: field wrapper, `position: relative`.
- `ds-datepicker__input`: the text input showing the chosen date (add `ds-input`).
- `ds-datepicker__toggle`: icon button inside the input that opens the popover; give it `aria-label` and `aria-expanded`.
- `ds-datepicker__popover`: the calendar surface, placed under the field.
- `ds-datepicker__header`: month and year (`ds-datepicker__title`) between previous and next `ds-button--icon` buttons.
- `ds-datepicker__weekdays` / `ds-datepicker__weekday`: Monday to Sunday labels.
- `ds-datepicker__grid` / `ds-datepicker__day`: seven columns of day buttons.
- `ds-datepicker__footer`: `Today` and `Clear` ghost buttons.

## States

Day modifiers: `--outside` (other month, muted), `--today` (ring), `--selected` (accent fill), `--has-items` (dot under the number, for days with tasks or deals), `--disabled` (not selectable). Days show a hover fill and a visible focus outline.

## Usage

- Weeks start on Monday.
- Every day is a `button` with an `aria-label` naming the full date, `data-value="<ISO date>"` and `data-field="<field>"`; a click sets the field and `data-toggles` closes the popover. Today and Clear carry the same attributes (Clear with an empty `data-value`). Mark the chosen day `aria-pressed="true"`.
- Show the popover only while the toggle is open; Esc or a click outside cancels in the app.
- Use for any date field: task due dates, deal close dates, invoice dates.
