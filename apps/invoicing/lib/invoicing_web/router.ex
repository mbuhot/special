defmodule InvoicingWeb.Router do
  use InvoicingWeb, :router

  import InvoicingWeb.UserAuth, only: [require_user: 2]

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {InvoicingWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :authenticated do
    plug :require_user
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", InvoicingWeb do
    pipe_through :browser

    get "/", PageController, :home
    live "/login", LoginLive
    post "/session", SessionController, :create
    delete "/session", SessionController, :delete
  end

  scope "/", InvoicingWeb do
    pipe_through [:browser, :authenticated]

    live_session :authenticated, on_mount: {InvoicingWeb.UserAuth, :require_user} do
      live "/dashboard", DashboardLive
      live "/invoices", InvoiceLive.Index
      live "/invoices/:id/edit", InvoiceLive.Edit
      live "/contacts", ContactLive.Index
      live "/contacts/new/edit", ContactLive.Edit, :new
      live "/contacts/:id/edit", ContactLive.Edit, :edit
      live "/contacts/:id", ContactLive.Show
      live "/companies", CompanyLive.Index
      live "/companies/new/edit", CompanyLive.Edit, :new
      live "/companies/:id/edit", CompanyLive.Edit, :edit
      live "/companies/:id", CompanyLive.Show
      live "/pipeline", DealLive.Board
      live "/deals/new/edit", DealLive.Edit, :new
      live "/deals/:id/edit", DealLive.Edit, :edit
      live "/deals/:id", DealLive.Show
      live "/tasks", TaskLive.Index
    end
  end

  if Application.compile_env(:invoicing, :spec_support, false) do
    scope "/__spec__", InvoicingWeb do
      pipe_through :api

      post "/reset", SpecSupportController, :reset
      post "/factory", SpecSupportController, :factory
      get "/entity/:entity/:id", SpecSupportController, :show
      post "/clock", SpecSupportController, :clock
    end
  end

  # Other scopes may use custom stacks.
  # scope "/api", InvoicingWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:invoicing, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: InvoicingWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
