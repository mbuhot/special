defmodule Invoicing.Billing.Invoice do
  @moduledoc "A bill for a company whose status follows draft, sent, paid or void."

  use Ash.Resource,
    domain: Invoicing.Billing,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshStateMachine]

  postgres do
    table "invoices"
    repo Invoicing.Repo
    migration_defaults issue_date: "fragment(\"CURRENT_DATE\")"
  end

  state_machine do
    state_attribute :status
    initial_states [:draft]
    default_initial_state :draft

    transitions do
      transition :send, from: :draft, to: :sent
      transition :mark_paid, from: :sent, to: :paid
      transition :void, from: :draft, to: :void
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true

      accept [
        :number,
        :company_id,
        :supplier_id,
        :issue_date,
        :due_date,
        :notes,
        :gst_rate,
        :prices
      ]

      allow_nil_input [:number]
      change Invoicing.Billing.Invoice.AssignNumber
      change Invoicing.Billing.Invoice.AssignSupplier
    end

    update :update do
      primary? true
      require_atomic? false
      accept [:number, :company_id, :issue_date, :due_date, :notes, :gst_rate, :prices]
      validate Invoicing.Billing.Invoice.DraftOnly
    end

    update :send do
      accept []
      change transition_state(:sent)
    end

    update :mark_paid do
      accept []
      require_atomic? false
      change transition_state(:paid)
      change Invoicing.Billing.Invoice.LogPaymentNote
    end

    update :void do
      accept []
      change transition_state(:void)
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action([:create, :update, :send]) do
      authorize_if actor_attribute_equals(:role, :accountant)
      authorize_if actor_attribute_equals(:role, :admin)
    end

    policy action([:mark_paid, :void, :destroy]) do
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :number, :string, allow_nil?: false, public?: true

    attribute :issue_date, :date,
      allow_nil?: false,
      public?: true,
      default: &__MODULE__.today/0

    attribute :due_date, :date, public?: true
    attribute :notes, :string, public?: true

    attribute :gst_rate, :decimal,
      allow_nil?: false,
      public?: true,
      default: Decimal.new(0),
      constraints: [min: 0]

    attribute :prices, :atom,
      allow_nil?: false,
      public?: true,
      default: :"exclude gst",
      constraints: [one_of: [:"exclude gst", :"include gst"]]

    timestamps()
  end

  relationships do
    belongs_to :company, Invoicing.CRM.Company,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true

    belongs_to :supplier, Invoicing.Billing.Business, public?: true

    has_many :line_items, Invoicing.Billing.LineItem do
      sort inserted_at: :asc, id: :asc
    end
  end

  calculations do
    calculate :sequence,
              :integer,
              expr(
                fragment(
                  "COALESCE(NULLIF(regexp_replace(?, '\\D', '', 'g'), '')::integer, 0)",
                  number
                )
              )

    calculate :gst,
              :decimal,
              expr(
                round(
                  if prices == :"include gst" do
                    taxable * gst_rate / (100 + gst_rate)
                  else
                    taxable * gst_rate / 100
                  end,
                  2
                )
              ),
              public?: true

    calculate :subtotal,
              :decimal,
              expr(
                round(
                  if prices == :"include gst" do
                    lines_total - gst
                  else
                    lines_total
                  end,
                  2
                )
              ),
              public?: true

    calculate :total, :decimal, expr(round(subtotal + gst, 2)), public?: true
  end

  aggregates do
    sum :lines_total, :line_items, :total, default: Decimal.new(0)

    sum :taxable, :line_items, :total,
      default: Decimal.new(0),
      public?: true,
      filter: expr(tax_code == :gst)
  end

  @doc "Returns today's date on the application clock."
  def today, do: DateTime.to_date(Invoicing.Clock.now())

  identities do
    identity :unique_number, [:number]
  end
end
