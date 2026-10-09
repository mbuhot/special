defmodule InvoicingWeb.SpecSupportController do
  @moduledoc "JSON endpoints that let an external runtime reset, seed and inspect the app."

  use InvoicingWeb, :controller

  alias Invoicing.{Clock, Repo}
  alias Invoicing.SpecSupport.Factory

  @domain_resources [
    Invoicing.Billing.LineItem,
    Invoicing.Billing.Invoice,
    Invoicing.CRM.Activity,
    Invoicing.Pipeline.Task,
    Invoicing.Pipeline.Deal,
    Invoicing.CRM.Contact,
    Invoicing.CRM.Company,
    Invoicing.Accounts.User
  ]

  def reset(conn, _params) do
    table_names = Enum.map_join(@domain_resources, ", ", &AshPostgres.DataLayer.Info.table/1)
    Repo.query!("TRUNCATE TABLE #{table_names} RESTART IDENTITY CASCADE")
    json(conn, %{ok: true})
  end

  def factory(conn, %{"entity" => entity_name, "attrs" => attrs} = params) do
    record = Factory.create(entity_name, attrs, params["ref"])
    fields = Factory.reload(entity_name, record.id)
    json(conn, fields |> Map.put("id", record.id) |> jsonable())
  end

  def show(conn, %{"entity" => entity_name, "id" => id}) do
    json(conn, entity_name |> Factory.reload(id) |> jsonable())
  end

  def clock(conn, %{"at" => nil}) do
    Clock.unfreeze_globally()
    json(conn, %{frozen: false})
  end

  def clock(conn, %{"at" => instant}) do
    {:ok, frozen_at, _utc_offset} = DateTime.from_iso8601(instant)
    Clock.freeze_globally(frozen_at)
    json(conn, %{frozen: true, at: DateTime.to_iso8601(frozen_at)})
  end

  defp jsonable(fields) do
    Map.new(fields, fn
      {field, %Decimal{} = amount} -> {field, Decimal.to_string(amount, :normal)}
      {field, value} -> {field, value}
    end)
  end
end
