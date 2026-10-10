defmodule Invoicing.Billing.Invoice.AssignNumber do
  @moduledoc "Numbers a new invoice INV- followed by the next three digit sequence, serialised by an advisory lock."

  use Ash.Resource.Change

  @lock_key 7_301_001
  @next_sequence_sql """
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '\\D', '', 'g'), '')::bigint), 0) + 1
  FROM invoices
  """

  @impl true
  def change(changeset, _opts, _context) do
    Ash.Changeset.before_action(changeset, fn changeset ->
      case Ash.Changeset.get_attribute(changeset, :number) do
        nil -> Ash.Changeset.force_change_attribute(changeset, :number, next_number())
        _given_number -> changeset
      end
    end)
  end

  defp next_number do
    Invoicing.Repo.query!("SELECT pg_advisory_xact_lock($1)", [@lock_key])
    %{rows: [[sequence]]} = Invoicing.Repo.query!(@next_sequence_sql)
    "INV-" <> String.pad_leading(Integer.to_string(sequence), 3, "0")
  end
end
