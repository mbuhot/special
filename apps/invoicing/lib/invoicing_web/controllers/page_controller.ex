defmodule InvoicingWeb.PageController do
  use InvoicingWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
