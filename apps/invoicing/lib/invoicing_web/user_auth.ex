defmodule InvoicingWeb.UserAuth do
  @moduledoc "Requires a signed-in user for conns and LiveViews."

  use InvoicingWeb, :verified_routes

  import Phoenix.Controller, only: [redirect: 2]
  import Plug.Conn

  alias Invoicing.Accounts

  @doc "Plug that assigns the signed-in user or redirects to the login page."
  def require_user(conn, _opts) do
    case fetch_user(get_session(conn, "user_id")) do
      nil -> conn |> redirect(to: ~p"/login") |> halt()
      user -> assign(conn, :current_user, user)
    end
  end

  @doc "LiveView mount hook that assigns the signed-in user and current path or redirects to the login page."
  def on_mount(:require_user, _params, session, socket) do
    case fetch_user(session["user_id"]) do
      nil ->
        {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/login")}

      user ->
        {:cont, socket |> Phoenix.Component.assign(:current_user, user) |> track_current_path()}
    end
  end

  defp track_current_path(socket) do
    socket
    |> Phoenix.Component.assign(:current_path, nil)
    |> Phoenix.LiveView.attach_hook(:current_path, :handle_params, fn _params, uri, socket ->
      {:cont, Phoenix.Component.assign(socket, :current_path, URI.parse(uri).path)}
    end)
  end

  defp fetch_user(nil), do: nil

  defp fetch_user(user_id) do
    case Accounts.get_user(user_id, not_found_error?: false, authorize?: false) do
      {:ok, user} -> user
      {:error, _error} -> nil
    end
  end
end
