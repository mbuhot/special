defmodule Invoicing.Pipeline.Task.AssigneeIsAssignable do
  @moduledoc "Rejects a task assignee whose role is neither sales nor manager."

  use Ash.Resource.Validation

  @assignable_roles [:sales, :manager]

  @impl true
  def validate(changeset, _opts, _context) do
    if assignable?(changeset) do
      :ok
    else
      {:error, field: :assignee_id, message: "must be a sales rep or a sales manager"}
    end
  end

  defp assignable?(changeset) do
    user_resource = Ash.Resource.Info.relationship(changeset.resource, :assignee).destination

    case Ash.get(user_resource, Ash.Changeset.get_attribute(changeset, :assignee_id),
           authorize?: false,
           error?: false
         ) do
      {:ok, %{role: role}} -> role in @assignable_roles
      _missing -> false
    end
  end
end
