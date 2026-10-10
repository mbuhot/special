alias Invoicing.{Accounts, Billing, CRM, Pipeline}

Code.require_file("seeds.exs", __DIR__)

user = fn email ->
  {:ok, found} = Accounts.get_user_by_email(email, authorize?: false)
  found
end

sales = user.("sales@example.com")
manager = user.("manager@example.com")
admin = user.("admin@example.com")
opts = [authorize?: false]
today = Date.utc_today()
days = fn offset -> Date.add(today, offset) end
at = fn offset -> DateTime.new!(days.(offset), ~T[10:00:00], "Etc/UTC") end

if Pipeline.list_deals!(opts) == [] do
  company = fn name, domain, industry ->
    case CRM.list_companies!(name, opts) do
      [existing | _] -> existing
      [] -> CRM.create_company!(%{name: name, domain: domain, industry: industry}, opts)
    end
  end

  acme = company.("Acme", "acme.example", "Manufacturing")
  globex = company.("Globex", "globex.example", "Logistics")
  initech = company.("Initech", "initech.example", "Software")
  umbrella = company.("Umbrella", "umbrella.example", "Healthcare")

  contact = fn first, last, email, phone, company ->
    CRM.create_contact!(
      %{first_name: first, last_name: last, email: email, phone: phone, company_id: company.id},
      opts
    )
  end

  ada = contact.("Ada", "Lovelace", "ada@acme.example", "555-0100", acme)
  grace = contact.("Grace", "Hopper", "grace@acme.example", "555-0101", acme)
  hank = contact.("Hank", "Scorpio", "hank@globex.example", "555-0200", globex)
  peter = contact.("Peter", "Gibbons", "peter@initech.example", "555-0300", initech)
  milton = contact.("Milton", "Waddams", "milton@initech.example", "555-0301", initech)
  alice = contact.("Alice", "Abernathy", "alice@umbrella.example", "555-0400", umbrella)

  activity = fn contact, kind, body, offset, author ->
    CRM.create_activity!(
      %{
        kind: kind,
        body: body,
        occurred_at: at.(offset),
        contact_id: contact.id,
        user_id: author.id
      },
      opts
    )
  end

  activity.(ada, :call, "Intro call about the spring order", -21, sales)
  activity.(ada, :email, "Sent pricing sheet", -18, sales)
  activity.(ada, :meeting, "Site visit with the plant manager", -7, manager)
  activity.(grace, :note, "Prefers email over phone", -15, sales)
  activity.(hank, :call, "Discussed a fleet tracking pilot", -10, sales)
  activity.(hank, :email, "Follow-up with pilot scope", -3, sales)
  activity.(peter, :meeting, "Demo for the operations team", -5, manager)
  activity.(milton, :note, "Asked about the stapler order again", -2, sales)
  activity.(alice, :call, "Renewal check-in", -1, sales)

  deal = fn name, amount, close_offset, company, contact, owner ->
    Pipeline.create_deal!(
      %{
        name: name,
        amount: Decimal.new(amount),
        close_date: days.(close_offset),
        company_id: company.id,
        contact_id: contact.id,
        owner_id: owner.id
      },
      opts
    )
  end

  spring = deal.("Spring order", "24000", 30, acme, ada, sales)
  spares = deal.("Spare parts contract", "8500", 45, acme, grace, sales)
  pilot = deal.("Fleet tracking pilot", "12000", 21, globex, hank, sales)
  rollout = deal.("Ops rollout", "36000", 60, initech, peter, manager)
  staplers = deal.("Stapler refresh", "900", 10, initech, milton, sales)
  renewal = deal.("Annual renewal", "18000", -5, umbrella, alice, manager)
  _audit = deal.("Compliance audit", "6000", 90, umbrella, alice, sales)

  Pipeline.qualify_deal!(spring, opts)
  Pipeline.qualify_deal!(pilot, opts) |> Pipeline.propose_deal!(opts)
  Pipeline.qualify_deal!(rollout, opts) |> Pipeline.propose_deal!(opts)
  Pipeline.lose_deal!(staplers, opts)

  Pipeline.qualify_deal!(renewal, opts)
  |> Pipeline.propose_deal!(opts)
  |> Pipeline.win_deal!(opts)

  _ = spares

  task = fn deal, title, due_offset ->
    Pipeline.create_task!(
      %{title: title, due_date: days.(due_offset), deal_id: deal.id, assignee_id: sales.id},
      opts
    )
  end

  task.(spring, "Send revised quote", 2)
  task.(spring, "Confirm delivery dates", -2)
  task.(pilot, "Book pilot kickoff", 5)
  task.(rollout, "Security questionnaire", -4)
  task.(spares, "Qualify budget", 7)
  task.(renewal, "Send thank-you note", -6) |> Pipeline.complete_task!(opts)

  invoice = fn company, issue_offset, lines ->
    created =
      Billing.create_invoice!(
        %{
          company_id: company.id,
          issue_date: days.(issue_offset),
          due_date: days.(issue_offset + 30),
          notes: "Thanks for your business"
        },
        opts
      )

    Enum.each(lines, fn {description, quantity, unit_price} ->
      Billing.create_line_item!(
        %{
          description: description,
          quantity: quantity,
          unit_price: Decimal.new(unit_price),
          invoice_id: created.id
        },
        opts
      )
    end)

    created
  end

  invoice.(umbrella, -40, [{"Annual licence", 1, "18000"}])
  |> Billing.send_invoice!(opts)
  |> Billing.mark_invoice_paid!(Keyword.put(opts, :actor, admin))

  invoice.(acme, -20, [{"Consulting", 12, "150"}, {"Travel", 1, "420"}])
  |> Billing.send_invoice!(opts)

  invoice.(globex, -10, [{"Pilot setup", 1, "2500"}]) |> Billing.send_invoice!(opts)
  invoice.(initech, -3, [{"Workshop", 2, "1200"}, {"Materials", 10, "35"}])
  invoice.(acme, -50, [{"Rush order", 1, "700"}]) |> Billing.void_invoice!(opts)
end
