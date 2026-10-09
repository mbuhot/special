defmodule SpecDSL.RunnerTest do
  use ExUnit.Case, async: true

  alias SpecDSL.{AST, Runner, Step, StepError}
  alias SpecDSL.Test.TraceHandlers

  setup_all do
    {:ok, ast: AST.load!("test/fixtures/invoicing.ast.json")}
  end

  defp scenario_with(ast, steps), do: %{hd(ast.scenarios) | steps: steps}

  defp messages do
    {:messages, messages} = Process.info(self(), :messages)
    messages
  end

  test "executes steps in order, passing the updated ctx between them", %{ast: ast} do
    Runner.run_scenario(ast, hd(ast.scenarios), TraceHandlers)

    assert {:trace, ["given-entity", "opens", "enters", "sees"]} in messages()
  end

  test "sets up contexts in requirement order and tears them down in reverse", %{ast: ast} do
    Runner.run_scenario(ast, hd(ast.scenarios), TraceHandlers)

    lifecycle = Enum.filter(messages(), &match?({event, _} when event in [:setup, :teardown], &1))

    assert lifecycle == [
             setup: :clock,
             setup: :data,
             setup: {:actor, "Accounts"},
             teardown: :actor,
             teardown: :data,
             teardown: :clock
           ]
  end

  test "creates an actor on first mention and reuses it on later mentions", %{ast: ast} do
    Runner.run_scenario(ast, hd(ast.scenarios), TraceHandlers)

    actor_setups = Enum.filter(messages(), &match?({:setup, {:actor, _}}, &1))

    assert actor_setups == [setup: {:actor, "Accounts"}]
  end

  test "skips steps that exclude the requested mode and narration steps", %{ast: ast} do
    scenario =
      scenario_with(
        ast,
        [
          %Step{id: "given-entity", line: 1, args: %{entity: "Customer"}},
          %Step{id: "given-entity", line: 2, args: %{entity: "Invoice"}, modes: [:demo]},
          %Step{id: "narrate", line: 3, text: "Narration only"}
        ]
      )

    Runner.run_scenario(ast, scenario, TraceHandlers, modes: [:test])

    assert {:trace, ["given-entity"]} in messages()
  end

  test "runs steps tagged for a mode only when that mode is requested", %{ast: ast} do
    scenario =
      scenario_with(
        ast,
        [%Step{id: "given-entity", line: 2, args: %{entity: "Invoice"}, modes: [:demo]}]
      )

    Runner.run_scenario(ast, scenario, TraceHandlers, modes: [:demo])

    assert {:trace, ["given-entity"]} in messages()
  end

  test "raises a step error carrying the Markdown line when a handler raises", %{ast: ast} do
    failing_step = %Step{
      id: "enters",
      line: 24,
      args: %{actor: "Accounts", value: "BOOM"},
      narrate: "Accounts enters BOOM."
    }

    scenario = scenario_with(ast, [failing_step])

    error = assert_raise StepError, fn -> Runner.run_scenario(ast, scenario, TraceHandlers) end

    assert error.step_id == "enters"
    assert error.line == 24
    assert error.text == "Accounts enters BOOM."
    assert error.exception == %RuntimeError{message: "entry rejected"}

    assert Exception.message(error) ==
             "step \"enters\" at specs/invoicing.md:24 (Accounts enters BOOM.) failed: ** (RuntimeError) entry rejected"
  end

  test "tears down contexts after a step fails", %{ast: ast} do
    failing_step = %Step{id: "enters", line: 24, args: %{actor: "Accounts", value: "BOOM"}}
    scenario = scenario_with(ast, [failing_step])

    assert_raise StepError, fn -> Runner.run_scenario(ast, scenario, TraceHandlers) end

    teardowns = Enum.filter(messages(), &match?({:teardown, _}, &1))

    assert teardowns == [teardown: :actor, teardown: :data, teardown: :clock]
  end
end
