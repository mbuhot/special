defmodule Invoicing.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Boundary, top_level?: true, check: [in: false, out: false]

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      InvoicingWeb.Telemetry,
      Invoicing.Repo,
      {DNSCluster, query: Application.get_env(:invoicing, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Invoicing.PubSub},
      # Start a worker by calling: Invoicing.Worker.start_link(arg)
      # {Invoicing.Worker, arg},
      # Start to serve requests, typically the last entry
      InvoicingWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Invoicing.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    InvoicingWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
