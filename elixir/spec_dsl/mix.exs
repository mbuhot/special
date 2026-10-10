defmodule SpecDSL.MixProject do
  use Mix.Project

  def project do
    [
      app: :spec_dsl,
      version: "0.1.0",
      elixir: "~> 1.20",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [extra_applications: [:logger]]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_env), do: ["lib"]

  defp deps do
    [
      {:jason, "~> 1.4"},
      {:decimal, "~> 2.0 or ~> 3.0"},
      {:stream_data, "~> 1.0"}
    ]
  end
end
