defmodule SpecDSL.CaseOptions do
  @moduledoc "Reads the `:ast`, `:adapter`, `:async` and `:register` options shared by the conformance case templates."

  alias SpecDSL.Union

  @doc "The ASTs the `:ast` glob matches, the files they came from, the adapter module and the ExUnit options."
  @spec read(Keyword.t(), Macro.Env.t()) ::
          %{asts: [SpecDSL.AST.t()], files: [Path.t()], adapter: module(), case_opts: Keyword.t()}
  def read(opts, caller) do
    {glob, _binding} = opts |> Keyword.fetch!(:ast) |> Code.eval_quoted([], caller)
    adapter = opts |> Keyword.fetch!(:adapter) |> Macro.expand(caller)
    files = Union.files(glob)

    %{
      asts: Enum.map(files, &SpecDSL.AST.load!/1),
      files: files,
      adapter: adapter,
      case_opts: [
        async: Keyword.get(opts, :async, true),
        register: Keyword.get(opts, :register, true)
      ]
    }
  end

  @doc "Quoted module preamble: the ExUnit case, external resources and the adapter's per-test setup."
  @spec preamble(map(), boolean()) :: Macro.t()
  def preamble(%{files: files, adapter: adapter, case_opts: case_opts}, with_setup?) do
    setup =
      if with_setup? do
        quote do
          setup tags do
            SpecDSL.Adapter.setup(unquote(adapter), tags)
          end
        end
      end

    quote do
      use ExUnit.Case, unquote(case_opts)

      unquote_splicing(
        Enum.map(files, fn file -> quote(do: @external_resource(unquote(file))) end)
      )

      unquote(setup)
    end
  end
end
