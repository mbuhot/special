defmodule SpecDSL.Test.TraceHandlers do
  @moduledoc "Handlers that record setup, teardown and step ids as messages to the running process."

  use SpecDSL.Handlers, dialect: "test/fixtures/invoicing.lock.json"

  alias SpecDSL.Ctx

  context(:clock,
    setup: fn config, _ctx ->
      send(self(), {:setup, :clock})
      config
    end,
    teardown: fn _instance, _ctx -> send(self(), {:teardown, :clock}) end
  )

  context(:data,
    setup: fn _config, _ctx ->
      send(self(), {:setup, :data})
      :data
    end,
    teardown: fn _instance, ctx ->
      send(self(), {:teardown, :data})
      send(self(), {:trace, trace(ctx)})
    end
  )

  context(:actor,
    setup: fn declaration, _ctx ->
      send(self(), {:setup, {:actor, declaration.name}})
      %{role: declaration.role}
    end,
    teardown: fn _session, _ctx -> send(self(), {:teardown, :actor}) end
  )

  step "given-entity", %{entity: _entity}, ctx do
    record(ctx, "given-entity")
  end

  step "opens", %{actor: actor, surface: surface}, ctx do
    ctx |> record("opens") |> Ctx.put_view(actor, surface)
  end

  step "enters", %{value: "BOOM"}, _ctx do
    raise "entry rejected"
  end

  step "enters", %{actor: actor, control: control}, ctx do
    ctx |> record("enters") |> Ctx.put_ref("entered by #{actor}", control.name)
  end

  step "sees", %{actor: actor}, ctx do
    assert_view_open(ctx, actor)
    record(ctx, "sees")
  end

  defp assert_view_open(ctx, actor) do
    %SpecDSL.Surface{} = Ctx.view(ctx, actor)
    :ok
  end

  defp record(ctx, step_id) do
    Ctx.put_ref(ctx, "trace", trace(ctx) ++ [step_id])
  end

  defp trace(ctx) do
    Map.get(ctx.refs, "trace", [])
  end
end
