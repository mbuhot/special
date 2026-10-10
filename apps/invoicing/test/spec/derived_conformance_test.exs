defmodule Invoicing.DerivedConformanceTest do
  use SpecDSL.DerivedCase, ast: "../../specs/**/*.ast.json", adapter: Invoicing.SpecAdapter
end
