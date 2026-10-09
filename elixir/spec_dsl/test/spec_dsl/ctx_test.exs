defmodule SpecDSL.CtxTest do
  use ExUnit.Case, async: true

  alias SpecDSL.{AST, Ctx}
  alias SpecDSL.Test.TraceHandlers

  setup_all do
    {:ok, ast: AST.load!("test/fixtures/invoicing.ast.json")}
  end

  test "stores and returns refs by name", %{ast: ast} do
    ctx = ast |> Ctx.new(TraceHandlers) |> Ctx.put_ref("INV-001", %{total: 300})

    assert Ctx.ref(ctx, "INV-001") == %{total: 300}
  end

  test "stores a view per actor", %{ast: ast} do
    ctx = ast |> Ctx.new(TraceHandlers) |> Ctx.put_view("Accounts", :editor)

    assert Ctx.view(ctx, "Accounts") == :editor
    assert Ctx.view(ctx, "Manager") == nil
  end

  test "sets up an actor's required contexts before the actor session", %{ast: ast} do
    {session, ctx} = ast |> Ctx.new(TraceHandlers) |> Ctx.actor("Accounts")

    assert session == %{role: "accountant"}
    assert Ctx.context(ctx, :data) == :data
    assert Ctx.context(ctx, :clock) == %{date_time: "2026-01-15T09:00:00Z"}
  end

  test "returns the same actor session on second access without a second setup", %{ast: ast} do
    {first_session, ctx} = ast |> Ctx.new(TraceHandlers) |> Ctx.actor("Accounts")
    {second_session, _ctx} = Ctx.actor(ctx, "Accounts")

    actor_setups =
      Enum.count(elem(Process.info(self(), :messages), 1), &match?({:setup, {:actor, _}}, &1))

    assert second_session == first_session
    assert actor_setups == 1
  end

  test "teardown runs in reverse setup order", %{ast: ast} do
    {_session, ctx} = ast |> Ctx.new(TraceHandlers) |> Ctx.actor("Accounts")

    assert Ctx.teardown(ctx) == :ok

    teardowns = Enum.filter(elem(Process.info(self(), :messages), 1), &match?({:teardown, _}, &1))

    assert teardowns == [teardown: :actor, teardown: :data, teardown: :clock]
  end
end
