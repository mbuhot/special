defmodule Invoicing.Pipeline.Task.AssignAssignee do
  @moduledoc "Makes the acting user the assignee of a task that names none."

  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, %{actor: %{id: actor_id}}) do
    Ash.Changeset.change_new_attribute(changeset, :assignee_id, actor_id)
  end

  def change(changeset, _opts, _context), do: changeset
end
