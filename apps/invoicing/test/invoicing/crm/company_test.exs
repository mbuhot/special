defmodule Invoicing.CRM.CompanyTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.CRM

  setup do
    CRM.create_company!(%{name: "Acme"}, authorize?: false)
    CRM.create_company!(%{name: "Globex"}, authorize?: false)
    :ok
  end

  defp names(companies), do: companies |> Enum.map(& &1.name) |> Enum.sort()

  test "searching matches part of a name ignoring case" do
    assert names(CRM.list_companies!("GLO", authorize?: false)) == ["Globex"]
  end

  test "listing without a search returns every company" do
    assert names(CRM.list_companies!(nil, authorize?: false)) == ["Acme", "Globex"]
  end
end
