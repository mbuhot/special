defmodule Invoicing.InvariantTest do
  use SpecDSL.InvariantCase, ast: "../../specs/**/*.ast.json", adapter: Invoicing.SpecAdapter
end
