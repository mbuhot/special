defmodule SpecDSL.CaseTest.Generated do
  use SpecDSL.Case,
    ast: "test/fixtures/*.ast.json",
    handlers: SpecDSL.Test.TraceHandlers,
    register: false
end

defmodule SpecDSL.CaseTest do
  use ExUnit.Case, async: true

  alias SpecDSL.CaseTest.Generated

  test "defines one test per scenario tagged with its spec file and line" do
    tests = Generated.Invoicing.__ex_unit__().tests

    assert Enum.map(tests, &{&1.name, &1.tags.spec_file, &1.tags.spec_line}) == [
             {:"test Line total updates as quantity changes", "specs/invoicing.md", 20},
             {:"test Invoice list shows the new invoice button", "specs/invoicing.md", 30}
           ]
  end

  test "a generated scenario test runs its steps through the handlers" do
    Generated.Invoicing."test Line total updates as quantity changes"(%{})

    {:messages, messages} = Process.info(self(), :messages)

    assert {:trace, ["given-entity", "opens", "enters", "sees"]} in messages
  end
end
