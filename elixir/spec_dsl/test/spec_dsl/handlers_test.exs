defmodule SpecDSL.HandlersTest do
  use ExUnit.Case, async: true

  @lock_path "test/fixtures/invoicing.lock.json"

  test "lists the step ids and context names a handlers module covers" do
    assert SpecDSL.Test.TraceHandlers.__spec_steps__() == [
             "given-entity",
             "opens",
             "enters",
             "sees"
           ]

    assert SpecDSL.Test.TraceHandlers.__spec_contexts__() == [:clock, :data, :actor]
  end

  test "a handlers module missing step ids and contexts fails to compile naming each of them" do
    source = """
    defmodule SpecDSL.HandlersTest.Incomplete do
      use SpecDSL.Handlers, dialect: "#{@lock_path}"

      context :clock, setup: fn config, _ctx -> config end

      step "opens", _args, ctx do
        ctx
      end
    end
    """

    error = assert_raise CompileError, fn -> Code.compile_string(source) end

    assert error.description =~ "steps without a clause: enters, given-entity, sees"
    assert error.description =~ "contexts without a clause: actor, data"
  end

  test "a clause for a step id absent from the lock fails to compile naming the id" do
    source = """
    defmodule SpecDSL.HandlersTest.Extra do
      use SpecDSL.Handlers, dialect: "#{@lock_path}"

      context :clock, setup: fn config, _ctx -> config end
      context :data, setup: fn config, _ctx -> config end
      context :actor, setup: fn config, _ctx -> config end

      step "given-entity", _args, ctx, do: ctx
      step "opens", _args, ctx, do: ctx
      step "enters", _args, ctx, do: ctx
      step "sees", _args, ctx, do: ctx
      step "deletes", _args, ctx, do: ctx
    end
    """

    error = assert_raise CompileError, fn -> Code.compile_string(source) end

    assert error.description =~ "clauses for steps absent from the lock: deletes"
  end
end
