defmodule Invoicing.SpecSupport.Factory do
  @moduledoc "Creates and reloads records addressed by spec entity name and spec field spelling."

  alias Invoicing.Accounts
  alias Invoicing.Accounts.User
  alias Invoicing.Billing
  alias Invoicing.Billing.{Invoice, LineItem}
  alias Invoicing.CRM
  alias Invoicing.CRM.{Company, Contact}

  @resources %{
    "Company" => Company,
    "Contact" => Contact,
    "Invoice" => Invoice,
    "LineItem" => LineItem,
    "User" => User
  }

  @calculations %{Contact => [:full_name], Invoice => [:total], LineItem => [:line_total]}

  @relationship_attributes %{"company" => "company_id", "invoice" => "invoice_id"}

  @natural_keys %{
    Invoice => "number",
    Company => "name",
    LineItem => "description",
    User => "email"
  }

  @doc "Creates a record of the named entity from spec-spelled attributes."
  def create(entity_name, attrs), do: create(entity_name, attrs, nil)

  @doc "Creates a record whose natural key defaults to the scenario ref."
  def create(entity_name, attrs, ref) do
    resource = resource_for!(entity_name)

    attrs
    |> normalize_keys()
    |> put_natural_key(resource, ref)
    |> build(resource)
  end

  @doc "Returns the record's fields, calculations included, as a string-keyed map."
  def reload(entity_name, id) do
    resource = resource_for!(entity_name)

    resource
    |> Ash.get!(id, load: Map.get(@calculations, resource, []), authorize?: false)
    |> to_field_map(resource)
  end

  @doc "Returns the record of the named entity with the given id."
  def fetch(entity_name, id) do
    entity_name
    |> resource_for!()
    |> Ash.get!(id, authorize?: false)
  end

  @doc "Reports whether the user may run the spec-spelled action on the record."
  def can?(entity_name, id, action_name, user) do
    action = action_name |> String.replace(" ", "_") |> String.to_existing_atom()
    Ash.can?({fetch(entity_name, id), action}, user)
  end

  defp build(attrs, Company) do
    sequence = System.unique_integer([:positive])

    attrs
    |> Map.put_new("name", "Company #{sequence}")
    |> CRM.create_company!(authorize?: false)
  end

  defp build(attrs, Contact) do
    sequence = System.unique_integer([:positive])

    attrs
    |> Map.put_new("first_name", "First#{sequence}")
    |> Map.put_new("last_name", "Last#{sequence}")
    |> Map.put_new_lazy("company_id", fn -> create("Company", %{}).id end)
    |> CRM.create_contact!(authorize?: false)
  end

  defp build(attrs, Invoice) do
    {status, invoice_attrs} = Map.pop(attrs, "status")

    invoice_attrs
    |> Map.put_new_lazy("company_id", fn -> create("Company", %{}).id end)
    |> Map.put_new_lazy("number", &Billing.next_invoice_number/0)
    |> Billing.create_invoice!(authorize?: false)
    |> put_status(status)
  end

  defp build(attrs, LineItem) do
    attrs
    |> Map.put_new_lazy("invoice_id", fn -> create("Invoice", %{}).id end)
    |> Billing.create_line_item!(authorize?: false)
  end

  defp build(attrs, User) do
    attrs
    |> Map.put_new_lazy("email", fn ->
      "user-#{System.unique_integer([:positive])}@example.com"
    end)
    |> Accounts.create_user!()
  end

  defp put_status(invoice, nil), do: invoice

  defp put_status(invoice, status) do
    Ash.Seed.update!(invoice, %{status: String.to_existing_atom(status)})
  end

  @doc "Returns the Ash resource module for the spec entity name."
  def resource_for!(entity_name) do
    case Map.fetch(@resources, entity_name) do
      {:ok, resource} -> resource
      :error -> raise ArgumentError, "unknown entity #{inspect(entity_name)}"
    end
  end

  defp put_natural_key(attrs, _resource, nil), do: attrs

  defp put_natural_key(attrs, resource, ref) do
    case Map.fetch(@natural_keys, resource) do
      {:ok, natural_key} -> Map.put_new(attrs, natural_key, ref)
      :error -> attrs
    end
  end

  defp normalize_keys(attrs) do
    Map.new(attrs, fn {field, value} ->
      snake_case_field = field |> to_string() |> String.replace(" ", "_")
      {Map.get(@relationship_attributes, snake_case_field, snake_case_field), value}
    end)
  end

  defp to_field_map(record, resource) do
    attribute_fields = Ash.Resource.Info.public_attributes(resource)
    calculation_fields = Map.get(@calculations, resource, [])

    (Enum.map(attribute_fields, & &1.name) ++ calculation_fields)
    |> Enum.flat_map(fn field -> field_entries(resource, field, Map.fetch!(record, field)) end)
    |> Map.new()
  end

  defp field_entries(resource, field, value) do
    exposed_value = expose(value)

    field
    |> spellings()
    |> Enum.concat(relationship_spellings(resource, field))
    |> Enum.map(&{&1, exposed_value})
  end

  defp spellings(field) do
    snake_case_field = Atom.to_string(field)
    Enum.uniq([snake_case_field, String.replace(snake_case_field, "_", " ")])
  end

  defp relationship_spellings(resource, field) do
    resource
    |> Ash.Resource.Info.relationships()
    |> Enum.filter(&(&1.type == :belongs_to and &1.source_attribute == field))
    |> Enum.map(&Atom.to_string(&1.name))
  end

  defp expose(nil), do: nil
  defp expose(value) when is_boolean(value), do: value
  defp expose(value) when is_atom(value), do: Atom.to_string(value)
  defp expose(value), do: value
end
