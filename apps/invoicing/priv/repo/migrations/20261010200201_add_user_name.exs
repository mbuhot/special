defmodule Invoicing.Repo.Migrations.AddUserName do
  @moduledoc """
  Adds the required user name, backfilled from the email local part.
  """

  use Ecto.Migration

  def up do
    alter table(:users) do
      add :name, :text
    end

    execute "UPDATE users SET name = split_part(email, '@', 1)"

    alter table(:users) do
      modify :name, :text, null: false
    end
  end

  def down do
    alter table(:users) do
      remove :name
    end
  end
end
