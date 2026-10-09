defmodule SpecDSL.Runner do
  @moduledoc "Executes one scenario: sets up contexts, dispatches steps, tears down."

  alias SpecDSL.{AST, Ctx, Scenario, Step, StepError}

  @presentation_step_ids ["narrate", "caption"]

  @doc "Runs a scenario's steps for the given modes through a handlers module."
  @spec run_scenario(AST.t(), Scenario.t(), module(), keyword()) :: :ok
  def run_scenario(%AST{} = ast, %Scenario{} = scenario, handlers, opts \\ []) do
    modes = Keyword.get(opts, :modes, [:test])
    steps = Enum.filter(scenario.steps, &runnable?(&1, modes))
    ctx = ast |> Ctx.new(handlers) |> setup_scoped_contexts()

    case execute_steps(ctx, scenario, steps) do
      {:ok, final_ctx} ->
        Ctx.teardown(final_ctx)

      {:error, failed_ctx, step_error} ->
        Ctx.teardown(failed_ctx)
        reraise step_error, step_error.stacktrace
    end
  end

  defp setup_scoped_contexts(ctx) do
    [:suite, :scenario]
    |> Enum.flat_map(&SpecDSL.Lock.contexts_in_scope(ctx.lock, &1))
    |> Enum.reduce(ctx, fn definition, acc -> Ctx.ensure_context(acc, definition.name) end)
  end

  defp runnable?(%Step{id: id}, _modes) when id in @presentation_step_ids, do: false
  defp runnable?(%Step{modes: nil}, _modes), do: true
  defp runnable?(%Step{modes: step_modes}, modes), do: Enum.any?(step_modes, &(&1 in modes))

  defp execute_steps(ctx, scenario, steps) do
    Enum.reduce_while(steps, {:ok, ctx}, fn step, {:ok, current_ctx} ->
      case execute_step(current_ctx, scenario, step) do
        {:ok, next_ctx} -> {:cont, {:ok, next_ctx}}
        {:error, failed_ctx, step_error} -> {:halt, {:error, failed_ctx, step_error}}
      end
    end)
  end

  defp execute_step(ctx, scenario, step) do
    with {:ok, actor_ctx} <- guarded(ctx, scenario, step, fn -> ensure_actor(ctx, step) end) do
      guarded(actor_ctx, scenario, step, fn ->
        actor_ctx.handlers.run_step(step.id, step.args, actor_ctx)
      end)
    end
  end

  defp guarded(ctx, scenario, step, action) do
    {:ok, action.()}
  rescue
    exception -> {:error, ctx, step_error(scenario, step, exception, __STACKTRACE__)}
  end

  defp ensure_actor(ctx, %Step{args: %{actor: actor_name}}) when is_binary(actor_name) do
    {_session, updated_ctx} = Ctx.actor(ctx, actor_name)
    updated_ctx
  end

  defp ensure_actor(ctx, _step), do: ctx

  defp step_error(scenario, step, exception, stacktrace) do
    %StepError{
      step_id: step.id,
      line: step.line,
      text: step.text || step.narrate,
      file: scenario.source.file,
      exception: exception,
      stacktrace: stacktrace
    }
  end
end
