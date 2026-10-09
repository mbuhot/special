defmodule InvoicingWeb.Layouts do
  @moduledoc """
  This module holds layouts and related functionality
  used by your application.
  """
  use InvoicingWeb, :html

  # Embed all files in layouts/* within this module.
  # The default root.html.heex file contains the HTML
  # skeleton of your application, namely HTML headers
  # and other static content.
  embed_templates "layouts/*"

  @doc """
  Renders your app layout.

  This function is typically invoked from every template,
  and it often contains your application menu, sidebar,
  or similar.

  ## Examples

      <Layouts.app flash={@flash}>
        <h1>Content</h1>
      </Layouts.app>

  """
  attr :flash, :map, required: true, doc: "the map of flash messages"

  attr :current_user, :map, default: nil, doc: "the signed-in user"
  attr :current_path, :string, default: nil, doc: "the path of the page being shown"
  attr :width, :atom, default: :narrow, values: [:narrow, :wide], doc: "the page content width"

  slot :inner_block, required: true

  def app(assigns) do
    ~H"""
    <div class="flex min-h-screen bg-base-100 text-base-content">
      <.sidebar :if={@current_user} current_user={@current_user} current_path={@current_path} />

      <main class="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <div class={[
          "mx-auto space-y-4",
          @width == :narrow && "max-w-2xl",
          @width == :wide && "max-w-7xl"
        ]}>
          {render_slot(@inner_block)}
        </div>
      </main>
    </div>

    <.flash_group flash={@flash} />
    """
  end

  attr :current_user, :map, required: true
  attr :current_path, :string, default: nil

  defp sidebar(assigns) do
    ~H"""
    <nav
      aria-label="Main"
      class="sticky top-0 flex h-screen w-60 flex-none flex-col gap-6 border-r border-base-300 bg-base-100 px-4 py-5"
    >
      <div class="px-3 py-1 text-lg font-bold">Ledger CRM</div>

      <div class="flex flex-col gap-1">
        <.nav_link
          :for={item <- nav_items()}
          id={item.id}
          path={item.path}
          icon={item.icon}
          label={item.label}
          active={active_nav?(item, @current_path)}
        />
      </div>

      <div class="flex-1"></div>

      <div id="signed-in-as" class="flex flex-col gap-0.5 border-t border-base-300 px-3 pt-3">
        <div class="text-sm font-semibold">{InvoicingWeb.Format.role_label(@current_user.role)}</div>
        <div class="truncate text-xs text-base-content/60">{@current_user.email}</div>
      </div>

      <.theme_toggle />
    </nav>
    """
  end

  attr :id, :string, required: true
  attr :path, :string, required: true
  attr :icon, :string, required: true
  attr :label, :string, required: true
  attr :active, :boolean, required: true

  defp nav_link(assigns) do
    ~H"""
    <.link
      id={@id}
      navigate={@path}
      aria-current={@active && "page"}
      class={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
        @active && "bg-primary/10 font-semibold text-primary",
        !@active && "font-medium text-base-content/80 hover:bg-base-200"
      ]}
    >
      <.icon name={@icon} class="size-5 flex-none" />
      <span>{@label}</span>
    </.link>
    """
  end

  defp nav_items do
    [
      %{
        id: "nav-dashboard",
        path: ~p"/dashboard",
        icon: "hero-home",
        label: "Dashboard",
        prefixes: ["/dashboard"]
      },
      %{
        id: "nav-contacts",
        path: ~p"/contacts",
        icon: "hero-users",
        label: "Contacts",
        prefixes: ["/contacts"]
      },
      %{
        id: "nav-companies",
        path: ~p"/companies",
        icon: "hero-building-office-2",
        label: "Companies",
        prefixes: ["/companies"]
      },
      %{
        id: "nav-pipeline",
        path: ~p"/pipeline",
        icon: "hero-funnel",
        label: "Pipeline",
        prefixes: ["/pipeline", "/deals"]
      },
      %{
        id: "nav-invoices",
        path: ~p"/invoices",
        icon: "hero-document-text",
        label: "Invoices",
        prefixes: ["/invoices"]
      }
    ]
  end

  defp active_nav?(_item, nil), do: false

  defp active_nav?(item, current_path) do
    Enum.any?(
      item.prefixes,
      &(current_path == &1 or String.starts_with?(current_path, &1 <> "/"))
    )
  end

  @doc """
  Shows the flash group with standard titles and content.

  ## Examples

      <.flash_group flash={@flash} />
  """
  attr :flash, :map, required: true, doc: "the map of flash messages"
  attr :id, :string, default: "flash-group", doc: "the optional id of flash container"

  def flash_group(assigns) do
    ~H"""
    <div id={@id} aria-live="polite">
      <.flash kind={:info} flash={@flash} />
      <.flash kind={:error} flash={@flash} />

      <.flash
        id="client-error"
        kind={:error}
        title={gettext("We can't find the internet")}
        phx-disconnected={
          show(".phx-client-error #client-error")
          |> JS.remove_attribute("hidden", to: ".phx-client-error #client-error")
        }
        phx-connected={hide("#client-error") |> JS.set_attribute({"hidden", ""})}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="hero-arrow-path" class="ml-1 size-3 motion-safe:animate-spin" />
      </.flash>

      <.flash
        id="server-error"
        kind={:error}
        title={gettext("Something went wrong!")}
        phx-disconnected={
          show(".phx-server-error #server-error")
          |> JS.remove_attribute("hidden", to: ".phx-server-error #server-error")
        }
        phx-connected={hide("#server-error") |> JS.set_attribute({"hidden", ""})}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="hero-arrow-path" class="ml-1 size-3 motion-safe:animate-spin" />
      </.flash>
    </div>
    """
  end

  @doc """
  Provides dark vs light theme toggle based on themes defined in app.css.

  See <head> in root.html.heex which applies the theme before page load.
  """
  def theme_toggle(assigns) do
    ~H"""
    <div class="card relative flex flex-row items-center border-2 border-base-300 bg-base-300 rounded-full">
      <div class="absolute w-1/3 h-full rounded-full border-1 border-base-200 bg-base-100 brightness-200 left-0 [[data-theme=light]_&]:left-1/3 [[data-theme=dark]_&]:left-2/3 [[data-theme-source=system]_&]:!left-0 transition-[left]" />

      <button
        class="flex p-2 cursor-pointer w-1/3"
        phx-click={JS.dispatch("phx:set-theme")}
        data-phx-theme="system"
      >
        <.icon name="hero-computer-desktop-micro" class="size-4 opacity-75 hover:opacity-100" />
      </button>

      <button
        class="flex p-2 cursor-pointer w-1/3"
        phx-click={JS.dispatch("phx:set-theme")}
        data-phx-theme="light"
      >
        <.icon name="hero-sun-micro" class="size-4 opacity-75 hover:opacity-100" />
      </button>

      <button
        class="flex p-2 cursor-pointer w-1/3"
        phx-click={JS.dispatch("phx:set-theme")}
        data-phx-theme="dark"
      >
        <.icon name="hero-moon-micro" class="size-4 opacity-75 hover:opacity-100" />
      </button>
    </div>
    """
  end
end
