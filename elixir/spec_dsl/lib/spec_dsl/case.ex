defmodule SpecDSL.Case do
  @moduledoc "Defines one ExUnit test per scenario found in AST JSON files matched by a glob."

  alias SpecDSL.AST

  @doc "Expands the `:ast` glob and defines a test per scenario that runs through the `:handlers` module."
  defmacro __using__(opts) do
    glob = Keyword.fetch!(opts, :ast)
    handlers = Keyword.fetch!(opts, :handlers)
    async = Keyword.get(opts, :async, false)
    register = Keyword.get(opts, :register, true)

    paths =
      glob
      |> Code.eval_quoted([], __CALLER__)
      |> elem(0)
      |> Path.expand()
      |> Path.wildcard()
      |> Enum.sort()

    quote do
      use ExUnit.Case, async: unquote(async), register: unquote(register)
      unquote_splicing(Enum.map(paths, &external_resource/1))
      unquote_splicing(Enum.flat_map(paths, &scenario_tests(&1, handlers)))
    end
  end

  defp external_resource(path) do
    quote do
      @external_resource unquote(path)
    end
  end

  defp scenario_tests(path, handlers) do
    ast = AST.load!(path)

    for scenario <- ast.scenarios do
      quote do
        @tag spec_file: unquote(scenario.source.file), spec_line: unquote(scenario.source.line)
        test unquote(scenario.name) do
          SpecDSL.Runner.run_scenario(
            unquote(Macro.escape(ast)),
            unquote(Macro.escape(scenario)),
            unquote(handlers),
            modes: [:test]
          )
        end
      end
    end
  end
end
