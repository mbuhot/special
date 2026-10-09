defmodule SpecDSL.Handlers do
  @moduledoc "Declares step and context handlers for a dialect lock and checks their coverage at compile time."

  alias SpecDSL.{Ctx, Lock}

  @presentation_step_ids ["narrate", "caption"]

  @doc "Binds the module to a lock file and enables the `context/2` and `step/4` macros."
  defmacro __using__(opts) do
    dialect_path = Keyword.fetch!(opts, :dialect)

    quote do
      import SpecDSL.Handlers, only: [context: 2, step: 4]
      @before_compile SpecDSL.Handlers
      Module.register_attribute(__MODULE__, :spec_dsl_steps, accumulate: true)
      Module.register_attribute(__MODULE__, :spec_dsl_contexts, accumulate: true)
      @spec_dsl_lock_path Path.expand(unquote(dialect_path))
      @external_resource @spec_dsl_lock_path
      @spec_dsl_lock SpecDSL.Lock.load!(@spec_dsl_lock_path)
    end
  end

  @doc "Declares the setup and teardown functions of a context."
  defmacro context(name, opts) when is_atom(name) do
    setup = Keyword.fetch!(opts, :setup)
    teardown = Keyword.get(opts, :teardown, quote(do: fn _instance, _ctx -> :ok end))
    setup_function = context_function_name(:setup, name)
    teardown_function = context_function_name(:teardown, name)

    quote do
      @spec_dsl_contexts {unquote(name), unquote(__CALLER__.line)}
      def unquote(setup_function)(declaration, ctx), do: unquote(setup).(declaration, ctx)
      def unquote(teardown_function)(instance, ctx), do: unquote(teardown).(instance, ctx)
    end
  end

  @doc "Declares one clause of the handler for a step id."
  defmacro step(id, args, ctx, do: body) when is_binary(id) do
    function_name = step_function_name(id)

    quote do
      @spec_dsl_steps {unquote(id), unquote(__CALLER__.line)}
      def unquote(function_name)(unquote(args), unquote(ctx)), do: unquote(body)
    end
  end

  defmacro __before_compile__(env) do
    lock = Module.get_attribute(env.module, :spec_dsl_lock)
    lock_path = Module.get_attribute(env.module, :spec_dsl_lock_path)
    declared_steps = env.module |> Module.get_attribute(:spec_dsl_steps) |> Enum.reverse()
    declared_contexts = env.module |> Module.get_attribute(:spec_dsl_contexts) |> Enum.reverse()

    step_ids = declared_steps |> Enum.map(&elem(&1, 0)) |> Enum.uniq()
    context_names = declared_contexts |> Enum.map(&elem(&1, 0)) |> Enum.uniq()

    check_coverage!(env, lock, lock_path, step_ids, context_names)

    quote do
      @doc false
      def __spec_lock__, do: unquote(Macro.escape(lock))
      @doc false
      def __spec_steps__, do: unquote(step_ids)
      @doc false
      def __spec_contexts__, do: unquote(context_names)

      unquote(step_dispatchers(step_ids))
      unquote(context_dispatchers(context_names))
    end
  end

  @doc false
  @spec normalize_result(String.t(), Ctx.t() | :ok, Ctx.t()) :: Ctx.t()
  def normalize_result(_id, :ok, ctx), do: ctx
  def normalize_result(_id, %Ctx{} = updated_ctx, _ctx), do: updated_ctx

  def normalize_result(id, other, _ctx) do
    raise ArgumentError, "step #{inspect(id)} returned #{inspect(other)}; expected a ctx or :ok"
  end

  defp step_dispatchers(step_ids) do
    clauses =
      for id <- step_ids do
        function_name = step_function_name(id)

        quote do
          def run_step(unquote(id), args, ctx) do
            SpecDSL.Handlers.normalize_result(
              unquote(id),
              apply(__MODULE__, unquote(function_name), [args, ctx]),
              ctx
            )
          end
        end
      end

    quote do
      unquote_splicing(clauses)

      def run_step(id, _args, _ctx),
        do: raise(ArgumentError, "no handler for step " <> inspect(id))
    end
  end

  defp context_dispatchers(context_names) do
    setup_clauses =
      for name <- context_names do
        setup_function = context_function_name(:setup, name)

        quote do
          def setup_context(unquote(name), declaration, ctx),
            do: unquote(setup_function)(declaration, ctx)
        end
      end

    teardown_clauses =
      for name <- context_names do
        teardown_function = context_function_name(:teardown, name)

        quote do
          def teardown_context(unquote(name), instance, ctx),
            do: unquote(teardown_function)(instance, ctx)
        end
      end

    quote do
      unquote_splicing(setup_clauses)
      unquote_splicing(teardown_clauses)
    end
  end

  defp check_coverage!(env, lock, lock_path, step_ids, context_names) do
    required_steps = Lock.step_ids(lock) -- @presentation_step_ids
    missing_steps = required_steps -- step_ids
    unknown_steps = step_ids -- Lock.step_ids(lock)
    missing_contexts = Lock.context_names(lock) -- context_names
    unknown_contexts = context_names -- Lock.context_names(lock)

    problems =
      [
        {"steps without a clause", missing_steps},
        {"contexts without a clause", missing_contexts},
        {"clauses for steps absent from the lock", unknown_steps},
        {"clauses for contexts absent from the lock", unknown_contexts}
      ]
      |> Enum.reject(fn {_label, names} -> names == [] end)
      |> Enum.map_join("\n", fn {label, names} ->
        "  #{label}: #{Enum.map_join(names, ", ", &to_string/1)}"
      end)

    if problems != "" do
      raise CompileError,
        file: env.file,
        line: 1,
        description: "#{inspect(env.module)} does not match #{lock_path}\n#{problems}"
    end
  end

  defp step_function_name(id), do: String.to_atom("__spec_step__#{id}")

  defp context_function_name(kind, name), do: String.to_atom("__spec_context_#{kind}__#{name}")
end
