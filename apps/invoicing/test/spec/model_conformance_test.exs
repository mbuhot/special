defmodule Invoicing.ModelConformanceTest do
  use SpecDSL.ModelCase, ast: "../../specs/**/*.ast.json", adapter: Invoicing.SpecAdapter
end
