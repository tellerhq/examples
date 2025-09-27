#!/usr/bin/env ruby
require "sinatra"
require "net/http"
require "base64"
require "openssl"
require "uri"

set :bind, "0.0.0.0"
set :port, (ENV["PORT"] || 8001).to_i

APP_ID      = ENV["APP_ID"]
ENVIRONMENT = ENV["ENV"] || "sandbox"
CERT        = ENV["CERT"]
CERT_KEY    = ENV["CERT_KEY"]

abort "APP_ID must be set (e.g. APP_ID=app_xxx)" if APP_ID.nil? || APP_ID.strip.empty?
if %w[development production].include?(ENVIRONMENT) && (CERT.nil? || CERT_KEY.nil?)
  abort "CERT and CERT_KEY must be set when ENV=#{ENVIRONMENT}"
end

BASE_TELLER_URL = "https://api.teller.io"

def static_dir
  File.expand_path("../static", __dir__)
end

def proxy_to_teller(path)
  uri = URI.join(BASE_TELLER_URL + "/", path)

  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  if CERT && CERT_KEY
    http.cert = OpenSSL::X509::Certificate.new(File.read(CERT))
    http.key  = OpenSSL::PKey.read(File.read(CERT_KEY)) # don’t assume RSA
  end

  method = request.request_method.capitalize
  klass = Net::HTTP.const_defined?(method) ? Net::HTTP.const_get(method) : Net::HTTP::Get
  upstream_req = klass.new(uri.request_uri)

  # Preserve Content-Type
  upstream_req["Content-Type"] = request.content_type if request.content_type
  upstream_req["Accept"] = "application/json"

  # Forward body for POST/PUT/PATCH
  if %w[POST PUT PATCH].include?(request.request_method)
    body = request.body.read
    upstream_req.body = body unless body.nil? || body.empty?
  end

  # Rewrite Authorization: <token> -> Basic base64(token:)
  if (raw = request.env["HTTP_AUTHORIZATION"])
    token = raw.strip
    upstream_req.basic_auth(token, "")
  end

  upstream_resp = http.request(upstream_req)

  status upstream_resp.code.to_i
  response.headers.clear
  upstream_resp.each_header do |k, v|
    next if %w[transfer-encoding connection content-encoding content-length].include?(k.downcase)
    response.headers[k] = v
  end
  content_type upstream_resp["content-type"] if upstream_resp["content-type"]

  upstream_resp.body
end

# Proxy verbs
%w[get post put delete patch options].each do |verb|
  send(verb, "/api/*") do
    subpath = params["splat"].first
    proxy_to_teller(subpath)
  end
end

# Root with substitutions
get "/" do
  html = File.read(File.join(static_dir, "index.html"))
  html = html.gsub("{{ app_id }}", APP_ID)
  html = html.gsub("{{ environment }}", ENVIRONMENT)
  content_type "text/html"
  html
end

# Static assets
get "/static/*" do
  file = params["splat"].first
  send_file File.join(static_dir, file)
end