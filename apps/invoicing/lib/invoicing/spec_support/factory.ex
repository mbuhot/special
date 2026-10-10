defmodule Invoicing.SpecSupport.Factory do
  @moduledoc "Creates and reloads records addressed by spec entity name and spec field spelling."

  use Boundary, top_level?: true, check: [in: false, out: false]

  alias Invoicing.Accounts
  alias Invoicing.Accounts.User
  alias Invoicing.Billing
  alias Invoicing.Billing.{Invoice, LineItem}
  alias Invoicing.CRM
  alias Invoicing.CRM.{Activity, Company, Contact}
  alias Invoicing.Pipeline
  alias Invoicing.Pipeline.{Deal, Task}

  @resources %{
    "Activity" => Activity,
    "Company" => Company,
    "Contact" => Contact,
    "Deal" => Deal,
    "Invoice" => Invoice,
    "LineItem" => LineItem,
    "Task" => Task,
    "User" => User
  }

  @calculations %{Contact => [:full_name], Invoice => [:total], LineItem => [:total]}

  @relationship_attributes %{
    "company" => "company_id",
    "contact" => "contact_id",
    "deal" => "deal_id",
    "invoice" => "invoice_id",
    "owner" => "owner_id",
    "user" => "user_id",
    "author" => "user_id"
  }

  @resource_relationship_attributes %{
    Deal => %{"user" => "owner_id"},
    Task => %{"user" => "assignee_id", "assignee" => "assignee_id"}
  }

  @natural_keys %{
    Invoice => "number",
    Company => "name",
    Deal => "name",
    LineItem => "description",
    Task => "title",
    User => "email"
  }

  @people %{
    "Sales rep" => %{role: "sales", name: "Sam Rivera"},
    "Sales manager" => %{role: "manager", name: "Morgan Lee"},
    "Accounts" => %{role: "accountant", name: "Alex Chen"},
    "Admin" => %{role: "admin", name: "Jordan Patel"}
  }
  @people_by_role Map.new(@people, fn {_ref, person} -> {person.role, person} end)

  @doc "Creates a record of the named entity from spec-spelled attributes."
  def create(entity_name, attrs), do: create(entity_name, attrs, nil)

  @doc "Creates a record whose natural key defaults to the scenario ref."
  def create(entity_name, attrs, ref) do
    resource = resource_for!(entity_name)

    attrs
    |> normalize_keys(resource)
    |> put_natural_key(resource, ref)
    |> build(resource)
  end

  @doc "Creates a record whose missing owner or assignee is the spec sales rep."
  def create_with_default_people(entity_name, attrs, ref) do
    create(entity_name, put_default_person(entity_name, attrs), ref)
  end

  defp put_default_person("Task", attrs),
    do: put_default_person(attrs, ["assignee", "assignee_id"], "assignee_id")

  defp put_default_person("Deal", attrs),
    do: put_default_person(attrs, ["owner", "owner_id"], "owner_id")

  defp put_default_person(_entity_name, attrs), do: attrs

  defp put_default_person(attrs, spellings, key) do
    if Enum.any?(spellings, &Map.has_key?(attrs, &1)),
      do: attrs,
      else: Map.put(attrs, key, default_sales_rep().id)
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

  defp build(attrs, Activity) do
    sequence = System.unique_integer([:positive])

    attrs
    |> Map.put_new("kind", "note")
    |> Map.put_new("body", "Activity #{sequence}")
    |> Map.put_new_lazy("contact_id", fn -> create("Contact", %{}).id end)
    |> Map.put_new_lazy("user_id", fn -> create("User", %{"role" => "sales"}).id end)
    |> CRM.create_activity!(authorize?: false)
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
    |> Billing.create_invoice!(authorize?: false)
    |> put_status(status)
  end

  defp build(attrs, Deal) do
    {stage, deal_attrs} = Map.pop(attrs, "stage")

    deal_attrs
    |> Map.put_new("name", "Deal #{System.unique_integer([:positive])}")
    |> Map.put_new_lazy("company_id", fn -> create("Company", %{}).id end)
    |> Map.put_new_lazy("owner_id", fn -> create("User", %{"role" => "sales"}).id end)
    |> Pipeline.create_deal!(authorize?: false)
    |> put_stage(stage)
  end

  defp build(attrs, LineItem) do
    seed_attributes =
      attrs
      |> Map.put_new_lazy("invoice_id", fn -> create("Invoice", %{}).id end)
      |> cast_attributes(LineItem)

    Ash.Seed.seed!(LineItem, seed_attributes)
  end

  defp build(attrs, Task) do
    {status, task_attrs} = Map.pop(attrs, "status")

    task_attrs
    |> Map.put_new("title", "Task #{System.unique_integer([:positive])}")
    |> Map.put_new("due_date", "2026-02-01")
    |> Map.put_new_lazy("deal_id", fn -> create("Deal", %{}).id end)
    |> Map.put_new_lazy("assignee_id", fn -> create("User", %{"role" => "sales"}).id end)
    |> Pipeline.create_task!(authorize?: false)
    |> put_status(status)
  end

  defp build(attrs, User) do
    user_attrs =
      attrs
      |> Map.put_new_lazy("email", fn ->
        "user-#{System.unique_integer([:positive])}@example.com"
      end)
      |> Map.put_new_lazy("name", fn -> default_person_name(attrs["role"]) end)

    case Accounts.get_user_by_email(user_attrs["email"],
           not_found_error?: false,
           authorize?: false
         ) do
      {:ok, nil} -> Accounts.create_user!(user_attrs, authorize?: false)
      {:ok, existing_user} -> Accounts.update_user!(existing_user, user_attrs, authorize?: false)
    end
  end

  defp person_email(ref),
    do: (ref |> String.downcase() |> String.replace(~r/\s+/, "-")) <> "@example.com"

  defp default_sales_rep, do: create("User", %{}, "Sales rep")

  defp default_person_name(role) do
    case Map.fetch(@people_by_role, to_string(role)) do
      {:ok, person} -> person.name
      :error -> "Person #{System.unique_integer([:positive])}"
    end
  end

  defp cast_attributes(attrs, resource) do
    Map.new(attrs, fn {name, value} ->
      attribute = Ash.Resource.Info.attribute(resource, String.to_existing_atom(name))
      {:ok, cast_value} = Ash.Type.cast_input(attribute.type, value, attribute.constraints)
      {attribute.name, cast_value}
    end)
  end

  defp put_status(invoice, nil), do: invoice

  defp put_status(invoice, status) do
    Ash.Seed.update!(invoice, %{status: String.to_existing_atom(status)})
  end

  defp put_stage(deal, nil), do: deal

  defp put_stage(deal, stage) do
    Ash.Seed.update!(deal, %{stage: String.to_existing_atom(stage)})
  end

  @doc "Returns the Ash resource module for the spec entity name."
  def resource_for!(entity_name) do
    case Map.fetch(@resources, entity_name) do
      {:ok, resource} -> resource
      :error -> raise ArgumentError, "unknown entity #{inspect(entity_name)}"
    end
  end

  defp put_natural_key(attrs, _resource, nil), do: attrs

  defp put_natural_key(attrs, User, ref) do
    person = Map.get(@people, ref, %{})

    attrs
    |> Map.put_new("email", person_email(ref))
    |> Map.put_new("role", Map.get(person, :role))
    |> Map.put_new("name", Map.get(person, :name))
    |> Map.reject(fn {_field, value} -> is_nil(value) end)
  end

  defp put_natural_key(attrs, resource, ref) do
    case Map.fetch(@natural_keys, resource) do
      {:ok, natural_key} -> Map.put_new(attrs, natural_key, ref)
      :error -> attrs
    end
  end

  defp normalize_keys(attrs, resource) do
    relationship_attributes = relationship_attributes_for(resource)

    Map.new(attrs, fn {field, value} ->
      snake_case_field = field |> to_string() |> String.replace(" ", "_")
      {Map.get(relationship_attributes, snake_case_field, snake_case_field), value}
    end)
  end

  defp relationship_attributes_for(resource) do
    Map.merge(@relationship_attributes, Map.get(@resource_relationship_attributes, resource, %{}))
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
