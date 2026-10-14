A grid of columns holding draggable cards, one column per state of a record.

Provide: a `ds-board` container with one `ds-board__column` per state, each headed by `ds-board__heading` (with an optional `ds-board__count`), and a `ds-board-card` per record. Set `--ds-board-columns` on the board for a column count other than 5.

- Use a board to move records between states; use a table to compare records.
- Card parts: `ds-board-card__title` (link to the record), `__meta` (secondary line), `__value` (figure with tabular digits), `__field` (inline label and control; pair a `ds-select ds-select--small` with it).
- A card with `draggable="true"` shows a grab cursor; add `ds-board-card--dragging` while it is dragged.
- Columns keep a minimum height so an empty column remains a drop target.
