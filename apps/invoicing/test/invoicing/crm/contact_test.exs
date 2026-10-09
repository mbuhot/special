defmodule Invoicing.CRM.ContactTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.CRM

  setup do
    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)
    globex = CRM.create_company!(%{name: "Globex"}, authorize?: false)

    CRM.create_contact!(%{first_name: "Ada", last_name: "Lovelace", company_id: acme.id},
      authorize?: false
    )

    CRM.create_contact!(%{first_name: "Grace", last_name: "Hopper", company_id: globex.id},
      authorize?: false
    )

    %{acme: acme}
  end

  defp full_names(contacts), do: contacts |> Enum.map(& &1.full_name) |> Enum.sort()

  test "searching matches a first or last name ignoring case" do
    by_first_name = CRM.list_contacts!("ada", nil, authorize?: false, load: [:full_name])
    by_last_name = CRM.list_contacts!("HOPP", nil, authorize?: false, load: [:full_name])

    assert full_names(by_first_name) == ["Ada Lovelace"]
    assert full_names(by_last_name) == ["Grace Hopper"]
  end

  test "listing by company returns that company's contacts", %{acme: acme} do
    contacts = CRM.list_contacts!(nil, acme.id, authorize?: false, load: [:full_name])

    assert full_names(contacts) == ["Ada Lovelace"]
  end

  test "searching and filtering by company combine", %{acme: acme} do
    contacts = CRM.list_contacts!("Hopper", acme.id, authorize?: false, load: [:full_name])

    assert contacts == []
  end
end
