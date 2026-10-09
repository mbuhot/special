defmodule Invoicing.CRM.Activity.AssignUser do
  @moduledoc "Makes the acting user the author of an activity that names none."

  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, %{actor: %{id: actor_id}}) do
    Ash.Changeset.change_new_attribute(changeset, :user_id, actor_id)
  end

  def change(changeset, _opts, _context), do: changeset
end
