defmodule Invoicing.Pipeline.Deal.AssignOwner do
  @moduledoc "Makes the acting user the owner of a deal that names none."

  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, %{actor: %{id: actor_id}}) do
    Ash.Changeset.change_new_attribute(changeset, :owner_id, actor_id)
  end

  def change(changeset, _opts, _context), do: changeset
end
