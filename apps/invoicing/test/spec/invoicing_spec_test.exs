defmodule Invoicing.InvoicingSpecTest do
  use SpecDSL.Case, ast: "../../specs/**/*.ast.json", handlers: Invoicing.SpecHandlers
end
