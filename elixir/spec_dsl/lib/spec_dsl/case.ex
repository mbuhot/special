defmodule SpecDSL.Case do
  @moduledoc "Defines one ExUnit module per AST JSON file matched by a glob, with one test per scenario."

  alias SpecDSL.AST

  @wildcard_characters ["*", "?", "[", "{"]

  @doc "Expands the `:ast` glob and defines a nested async test module per file that runs its scenarios through the `:handlers` module."
  defmacro __using__(opts) do
    glob = Keyword.fetch!(opts, :ast)
    handlers = Keyword.fetch!(opts, :handlers)
    async = Keyword.get(opts, :async, true)
    register = Keyword.get(opts, :register, true)

    pattern =
      glob
      |> Code.eval_quoted([], __CALLER__)
      |> elem(0)
      |> Path.expand()

    base_directory = static_prefix(pattern)

    feature_modules =
      pattern
      |> Path.wildcard()
      |> Enum.sort()
      |> Enum.map(fn path ->
        module = feature_module(__CALLER__.module, base_directory, path)
        feature_module_definition(module, path, handlers, async, register)
      end)

    quote do
      (unquote_splicing(feature_modules))
    end
  end

  defp feature_module_definition(module, path, handlers, async, register) do
    quote do
      defmodule unquote(module) do
        use ExUnit.Case, async: unquote(async), register: unquote(register)
        @external_resource unquote(path)
        unquote_splicing(scenario_tests(path, handlers))
      end
    end
  end

  defp static_prefix(pattern) do
    pattern
    |> Path.split()
    |> Enum.take_while(fn segment -> not String.contains?(segment, @wildcard_characters) end)
    |> Path.join()
  end

  defp feature_module(parent, base_directory, path) do
    segments =
      path
      |> Path.relative_to(base_directory)
      |> String.replace_suffix(".ast.json", "")
      |> Path.split()
      |> Enum.map(&(&1 |> String.replace("-", "_") |> Macro.camelize()))

    Module.concat([parent | segments])
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
            modes: [:test, :domain]
          )
        end
      end
    end
  end
end
