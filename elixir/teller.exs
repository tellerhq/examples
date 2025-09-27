Mix.install([
  {:plug_cowboy, "~> 2.6"},
  {:httpoison, "~> 2.2"}
])

defmodule Teller.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  @app_id System.get_env("APP_ID") || raise "APP_ID must be set"
  @env    System.get_env("ENV") || "sandbox"
  @cert   System.get_env("CERT")
  @key    System.get_env("CERT_KEY")

  if @env in ["development", "production"] and (!@cert or !@key) do
    raise "CERT and CERT_KEY must be set when ENV=#{@env}"
  end

  # -------- Root (inject {{ app_id }} / {{ environment }}) --------
  get "/" do
    static_dir = Path.expand("../static", __DIR__)
    html =
      File.read!(Path.join(static_dir, "index.html"))
      |> String.replace("{{ app_id }}", @app_id, global: false)
      |> String.replace("{{ environment }}", @env,    global: false)

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  # -------- Static --------
  get "/static/*path" do
    static_dir = Path.expand("../static", __DIR__)
    file = Path.join([static_dir | path])

    if File.exists?(file), do: send_file(conn, 200, file), else: send_resp(conn, 404, "not found")
  end

  # -------- Proxy /api/* -> https://api.teller.io/* --------
  match "/api/*path" do
    teller_url = "https://api.teller.io/" <> Enum.join(path, "/")

    # Rewrite Authorization: <token> -> Basic base64("token:")
    headers =
      case get_req_header(conn, "authorization") do
        [token] -> [{"authorization", "Basic " <> Base.encode64(token <> ":")} | drop_auth(conn.req_headers)]
        _       -> drop_auth(conn.req_headers)
      end

    # Read body once
    {:ok, body, _} = Plug.Conn.read_body(conn)

    # TLS client certs (dev/prod)
    hackney_opts =
      if @cert && @key, do: [ssl_options: [certfile: @cert, keyfile: @key]], else: []

    # Forward
    method = conn.method |> String.to_atom()
    resp   = HTTPoison.request!(method, teller_url, body, headers, hackney: hackney_opts)

    resp_headers =
      resp.headers
      |> Enum.reject(fn {k, _} -> k in ["connection", "transfer-encoding"] end)

    conn
    |> put_resp_headers(resp_headers)
    |> send_resp(resp.status_code, resp.body)
  end

  match _ do
    send_resp(conn, 404, "not found")
  end

  defp put_resp_headers(conn, headers),
    do: Enum.reduce(headers, conn, fn {k, v}, acc -> Plug.Conn.put_resp_header(acc, k, v) end)

  defp drop_auth(headers),
    do: Enum.reject(headers, fn {k, _} -> k == "authorization" end)
end

require Logger

port = String.to_integer(System.get_env("PORT") || "8001")
Logger.info("Listening on http://localhost:#{port} (ENV=#{System.get_env("ENV") || "sandbox"}, APP_ID=#{System.get_env("APP_ID")})")

{:ok, _} = Plug.Cowboy.http(Teller.Router, [], port: port)
Process.sleep(:infinity)