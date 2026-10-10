defmodule Invoicing.PolicyConformanceTest do
  use SpecDSL.PolicyCase, ast: "../../specs/**/*.ast.json", adapter: Invoicing.SpecAdapter
end
