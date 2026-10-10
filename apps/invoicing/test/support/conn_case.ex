defmodule InvoicingWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common data structures and query the data layer.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use InvoicingWeb.ConnCase, async: true`, although
  this option is not recommended for other databases.
  """

  use Boundary, top_level?: true, check: [in: false, out: false]
  use ExUnit.CaseTemplate

  using do
    quote do
      # The default endpoint for testing
      @endpoint InvoicingWeb.Endpoint

      use InvoicingWeb, :verified_routes

      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import InvoicingWeb.ConnCase
      import Invoicing.DataCase, only: [unique_email: 1]
    end
  end

  setup tags do
    Invoicing.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
