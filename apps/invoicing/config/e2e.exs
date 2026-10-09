import Config

import_config "dev.exs"

config :invoicing, Invoicing.Repo, database: "invoicing_e2e"

config :invoicing, InvoicingWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4012],
  server: true,
  code_reloader: false,
  debug_errors: false,
  watchers: []

config :phoenix_live_view,
  debug_heex_annotations: false,
  debug_attributes: false

config :invoicing, spec_support: true
