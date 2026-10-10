defmodule Invoicing.SpecHandlers do
  @moduledoc "Runs invoicing spec steps in-process through Phoenix.LiveViewTest and the Ecto sandbox."

  use Boundary, top_level?: true, check: [in: false, out: false]
  use SpecDSL.Handlers, dialect: "../../dialects/invoicing.lock.json"

  import ExUnit.Assertions
  import Phoenix.ConnTest, only: [build_conn: 0, get: 2]
  import Phoenix.LiveViewTest

  alias Ecto.Adapters.SQL.Sandbox
  alias Invoicing.{Accounts, Clock}
  alias Invoicing.SpecSupport.Factory
  alias SpecDSL.{Ctx, Derived, Scenario}

  @endpoint InvoicingWeb.Endpoint

  @seconds_per_unit %{"second" => 1, "minute" => 60, "hour" => 3_600, "day" => 86_400}
  @roles %{
    "sales" => :sales,
    "manager" => :manager,
    "accountant" => :accountant,
    "admin" => :admin
  }

  context(:app,
    setup: fn _config, _ctx -> %{endpoint: InvoicingWeb.Endpoint} end
  )

  context(:data,
    setup: fn _config, ctx ->
      owner = Sandbox.start_owner!(Invoicing.Repo, shared: false)
      %{owner: owner, users: create_scenario_users(ctx)}
    end,
    teardown: fn %{owner: owner}, _ctx -> Sandbox.stop_owner(owner) end
  )

  context(:clock,
    setup: fn config, _ctx ->
      frozen_at = frozen_instant(config)
      Clock.freeze(frozen_at)
      frozen_at
    end,
    teardown: fn _frozen_at, _ctx -> Clock.unfreeze() end
  )

  context(:actor,
    setup: fn declaration, ctx -> sign_in_actor(declaration, ctx) end
  )

  step "opens", %{actor: actor, surface: surface} = args, ctx do
    session = actor_session(ctx, actor)
    path = expand_route(surface.route, Map.get(args, :ref), ctx)
    {:ok, view, _html} = live(session.conn, path)
    store_navigation(ctx, actor, view, path)
  end

  step "is-on", %{actor: actor, surface: surface}, ctx do
    actual_path = Ctx.path(ctx, actor)

    assert to_string(actual_path) =~ route_pattern(surface.route),
           "expected #{actor} to be on #{surface.name} (#{surface.route}), found #{inspect(actual_path)}"

    ctx
  end

  step "enters", %{actor: actor, value: value, control: control}, ctx do
    submit_field_change(ctx, actor, control, value)
  end

  step "selects", %{actor: actor, value: value, control: control}, ctx do
    option_value = option_value_for_label(ctx, actor, control, resolve_value(ctx, value))
    submit_field_change(ctx, actor, control, option_value)
  end

  step "clicks", %{actor: actor, control: control}, ctx do
    view = Ctx.view(ctx, actor)
    method = link_method(view, control)
    result = view |> element(control.locators.lv) |> render_click()
    follow_navigation(ctx, actor, result, method)
  end

  step "sees", %{actor: actor, text: text, control: control}, ctx do
    view = Ctx.view(ctx, actor)

    assert has_element?(view, control.locators.lv, text),
           "expected #{inspect(text)} in #{control.name}, found: #{element_text(view, control)}"

    ctx
  end

  step "sees", %{actor: actor, text: text}, ctx do
    assert ctx |> Ctx.view(actor) |> render() =~ text
    ctx
  end

  step "sees-before", %{actor: actor, text: text, other: other, control: control}, ctx do
    rendered_text = ctx |> Ctx.view(actor) |> element_text(control) |> strip_tags()
    text_index = index_of(rendered_text, text)
    other_index = index_of(rendered_text, other)

    assert text_index != nil and other_index != nil and text_index < other_index,
           "expected #{inspect(text)} before #{inspect(other)} in #{control.name}, found: #{rendered_text}"

    ctx
  end

  step "no-longer-sees", %{actor: actor, text: text, control: control}, ctx do
    refute has_element?(Ctx.view(ctx, actor), control.locators.lv, text),
           "expected #{inspect(text)} to be absent from #{control.name}"

    ctx
  end

  step "no-longer-sees", %{actor: actor, text: text}, ctx do
    refute ctx |> Ctx.view(actor) |> render() =~ text
    ctx
  end

  step "given-entity", %{entity: entity, ref: ref_name, pairs: pairs}, ctx do
    attributes = Map.new(pairs, fn [field, value] -> {field, resolve_value(ctx, value)} end)
    record = Factory.create(entity, attributes, ref_name)
    Ctx.put_ref(ctx, ref_name, %{entity: entity, id: record.id})
  end

  step "has-field", %{ref: ref_name, field: field, value: expected}, ctx do
    %{entity: entity, id: id} = Ctx.ref(ctx, ref_name)
    actual = entity |> Factory.reload(id) |> Map.fetch!(field)

    assert to_string(actual) == expected,
           "expected #{ref_name} to have #{field} #{expected}, found #{inspect(actual)}"

    ctx
  end

  step "is-predicate", %{ref: ref_name, predicate: predicate_name}, ctx do
    assert predicate_holds?(ctx, ref_name, predicate_name),
           "expected #{ref_name} to be #{predicate_name}"

    ctx
  end

  step "is-not-predicate", %{ref: ref_name, predicate: predicate_name}, ctx do
    refute predicate_holds?(ctx, ref_name, predicate_name),
           "expected #{ref_name} not to be #{predicate_name}"

    ctx
  end

  step "may", %{actor: actor, action: action, ref: ref_name}, ctx do
    assert may?(ctx, actor, action, ref_name),
           "expected #{actor} to be allowed to #{action} #{ref_name}"

    ctx
  end

  step "may-not", %{actor: actor, action: action, ref: ref_name}, ctx do
    refute may?(ctx, actor, action, ref_name),
           "expected #{actor} to be refused from #{action} #{ref_name}"

    ctx
  end

  step "does-not-see", %{actor: actor, control: control}, ctx do
    refute has_element?(Ctx.view(ctx, actor), control.locators.lv),
           "expected #{actor} not to see #{control.name}"

    ctx
  end

  step "time-advances", %{duration: duration}, ctx do
    Clock.freeze(DateTime.add(Clock.now(), duration_seconds(duration)))
    ctx
  end

  step "job-runs", %{job: _job}, _ctx do
    raise "no jobs in this app"
  end

  defp frozen_instant(%{date_time: iso_instant}) do
    {:ok, instant, _offset} = DateTime.from_iso8601(iso_instant)
    instant
  end

  defp frozen_instant(_config), do: DateTime.utc_now()

  defp create_scenario_users(%Ctx{scenario: nil}), do: %{}

  defp create_scenario_users(%Ctx{scenario: scenario, ast: ast}) do
    scenario
    |> Scenario.actors()
    |> Enum.map(fn actor_name -> {actor_email(actor_name), actor_name} end)
    |> Enum.sort()
    |> Map.new(fn {email, actor_name} ->
      declaration = Map.fetch!(ast.actors, actor_name)
      attributes = %{email: email, role: Map.fetch!(@roles, declaration.role)}
      {actor_name, Factory.create("User", Map.merge(attributes, display_name(ast, declaration)))}
    end)
  end

  defp display_name(ast, %{name: display_name}) do
    if Enum.any?(ast.model["User"].fields, &(&1.name == "name")),
      do: %{name: display_name},
      else: %{}
  end

  defp display_name(_ast, _declaration), do: %{}

  defp sign_in_actor(declaration, ctx) do
    user = Map.fetch!(Ctx.context(ctx, :data).users, declaration.name)
    %{user: user, conn: Accounts.log_in_conn(build_conn(), user)}
  end

  defp actor_email(actor_name),
    do: (actor_name |> String.downcase() |> String.replace(~r/\s+/, "-")) <> "@example.com"

  defp predicate_holds?(ctx, ref_name, predicate_name) do
    %{entity: entity, id: id} = Ctx.ref(ctx, ref_name)

    predicate =
      Enum.find(ctx.ast.derived.predicates, &(&1.entity == entity and &1.name == predicate_name)) ||
        raise ArgumentError, "unknown predicate #{predicate_name} of #{entity}"

    reloaded = Factory.reload(entity, id)

    record =
      Map.new(Derived.fields(predicate), fn field ->
        {field, Map.get(reloaded, Atom.to_string(field))}
      end)

    Derived.holds?(predicate, record, DateTime.to_date(Clock.now()))
  end

  defp may?(ctx, actor, action, ref_name) do
    %{entity: entity, id: id} = Ctx.ref(ctx, ref_name)
    Factory.can?(entity, id, action, actor_session(ctx, actor).user)
  end

  defp actor_session(ctx, actor), do: Map.fetch!(ctx.actors, actor)

  defp expand_route(route, nil, _ctx), do: route

  defp expand_route(route, ref_name, ctx) do
    String.replace(route, "{id}", Ctx.ref(ctx, ref_name).id)
  end

  defp store_navigation(ctx, actor, view, path) do
    ctx |> Ctx.put_view(actor, view) |> Ctx.put_path(actor, path)
  end

  defp route_pattern(route) do
    source = route |> String.split("{id}") |> Enum.map_join("[^/]+", &Regex.escape/1)
    Regex.compile!("^" <> source <> "$")
  end

  defp resolve_value(ctx, value) when is_binary(value) do
    case Map.fetch(ctx.refs, value) do
      {:ok, %{id: id}} -> id
      :error -> value
    end
  end

  defp resolve_value(_ctx, value), do: value

  defp submit_field_change(ctx, actor, control, value) do
    params = nest_input_name(control.locators.lv, value)

    ctx
    |> Ctx.view(actor)
    |> form(control.locators.form, params)
    |> render_change()

    ctx
  end

  defp nest_input_name(input_name, value) do
    [{input_name, value}] |> URI.encode_query() |> Plug.Conn.Query.decode()
  end

  defp follow_navigation(ctx, actor, {:error, {:live_redirect, %{to: path}}}, _method) do
    session = actor_session(ctx, actor)
    {:ok, view, _html} = live(session.conn, path)
    store_navigation(ctx, actor, view, path)
  end

  defp follow_navigation(ctx, actor, {:error, {:redirect, %{to: path}}}, method) do
    session = actor_session(ctx, actor)

    response =
      Phoenix.ConnTest.dispatch(Phoenix.ConnTest.recycle(session.conn), @endpoint, method, path)

    landing_path = Phoenix.ConnTest.redirected_to(response)
    {:ok, view, _html} = live(Phoenix.ConnTest.recycle(response), landing_path)
    store_navigation(ctx, actor, view, landing_path)
  end

  defp follow_navigation(ctx, _actor, _rendered, _method), do: ctx

  defp link_method(view, control) do
    view
    |> element(control.locators.lv)
    |> render()
    |> LazyHTML.from_fragment()
    |> LazyHTML.attribute("data-method")
    |> List.first("get")
    |> String.to_existing_atom()
  end

  defp option_value_for_label(ctx, actor, control, label) do
    ctx
    |> Ctx.view(actor)
    |> element(control.locators.form)
    |> render()
    |> LazyHTML.from_fragment()
    |> LazyHTML.query(~s(select[name="#{control.locators.lv}"] option))
    |> Enum.find_value(label, fn option ->
      option_text = option |> LazyHTML.text() |> String.trim()
      if option_text == label, do: option |> LazyHTML.attribute("value") |> List.first()
    end)
  end

  defp element_text(view, control) do
    view |> element(control.locators.lv) |> render()
  end

  defp strip_tags(html),
    do: html |> String.replace(~r/<[^>]*>/, " ") |> String.replace(~r/\s+/, " ")

  defp index_of(haystack, needle) do
    case :binary.match(haystack, needle) do
      {index, _length} -> index
      :nomatch -> nil
    end
  end

  defp duration_seconds(duration) do
    %{"amount" => amount, "unit" => unit} =
      Regex.named_captures(~r/^(?<amount>\d+)\s+(?<unit>[a-z]+?)s?$/, String.trim(duration)) ||
        raise ArgumentError, "unsupported duration #{inspect(duration)}"

    String.to_integer(amount) * Map.fetch!(@seconds_per_unit, unit)
  end
end
