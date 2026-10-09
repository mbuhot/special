defmodule InvoicingWeb.LoginLive do
  @moduledoc "Email login form."

  use InvoicingWeb, :live_view

  alias Invoicing.Accounts

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     assign(socket,
       form: to_form(%{"email" => ""}, as: :login),
       login_status: :idle
     )}
  end

  @impl true
  def handle_event("submit", %{"login" => %{"email" => email} = params}, socket) do
    login_status =
      case Accounts.get_user_by_email(email, not_found_error?: false) do
        {:ok, %Accounts.User{}} -> :accepted
        _no_user -> :unknown_user
      end

    {:noreply, assign(socket, form: to_form(params, as: :login), login_status: login_status)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.header>Log in</.header>
      <.form
        for={@form}
        id="login-form"
        action={~p"/session"}
        method="post"
        phx-submit="submit"
        phx-trigger-action={@login_status == :accepted}
      >
        <.input
          field={@form[:email]}
          type="email"
          id="login-email"
          label="Email"
          autocomplete="email"
        />
        <p :if={@login_status == :unknown_user} id="login-error" class="text-error mb-2">
          No such user
        </p>
        <.button id="login-submit" variant="primary">Log in</.button>
      </.form>
    </Layouts.app>
    """
  end
end
