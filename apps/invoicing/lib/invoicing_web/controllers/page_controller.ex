defmodule InvoicingWeb.PageController do
  @moduledoc "Sends visitors of the root path to the dashboard or the login page."

  use InvoicingWeb, :controller

  def home(conn, _params) do
    case get_session(conn, :user_id) do
      nil -> redirect(conn, to: ~p"/login")
      _user_id -> redirect(conn, to: ~p"/dashboard")
    end
  end
end
