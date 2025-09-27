using System.Net;
using System.Net.Http.Headers;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text;

// -------- Env vars --------
var appId   = Environment.GetEnvironmentVariable("APP_ID");
var env     = Environment.GetEnvironmentVariable("ENV") ?? "sandbox";
var certPem = Environment.GetEnvironmentVariable("CERT");      // path to PEM cert
var keyPem  = Environment.GetEnvironmentVariable("CERT_KEY");  // path to PEM private key
var port    = Environment.GetEnvironmentVariable("PORT") ?? "8001";

if (string.IsNullOrEmpty(appId))
{
    Console.Error.WriteLine("APP_ID must be set");
    return;
}
if ((env.Equals("development", StringComparison.OrdinalIgnoreCase) ||
     env.Equals("production",   StringComparison.OrdinalIgnoreCase)) &&
    (string.IsNullOrEmpty(certPem) || string.IsNullOrEmpty(keyPem)))
{
    Console.Error.WriteLine($"CERT and CERT_KEY must be set when ENV={env}");
    return;
}

var builder = WebApplication.CreateBuilder(args);

// -------- mTLS-capable upstream handler --------
builder.Services.AddSingleton<HttpMessageHandler>(_ =>
{
    var handler = new HttpClientHandler
    {
        AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
        SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
        ClientCertificateOptions = ClientCertificateOption.Manual,
        CheckCertificateRevocationList = true
    };

    if (env.Equals("development", StringComparison.OrdinalIgnoreCase) ||
        env.Equals("production",   StringComparison.OrdinalIgnoreCase))
    {
        var clientCert = X509Certificate2.CreateFromPemFile(certPem!, keyPem!);
        handler.ClientCertificates.Add(clientCert);
    }

    return handler;
});

builder.Services.AddHttpClient("Upstream")
    .ConfigurePrimaryHttpMessageHandler(sp => sp.GetRequiredService<HttpMessageHandler>());

var app = builder.Build();

var staticDir = Path.Combine("..", "static");

// -------- Root: inject config into index.html --------
app.MapGet("/", async context =>
{
    var html = await File.ReadAllTextAsync(Path.Combine(staticDir, "index.html"));
    html = html.Replace("{{ app_id }}", appId!, StringComparison.Ordinal);
    html = html.Replace("{{ environment }}", env, StringComparison.Ordinal);
    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.WriteAsync(html);
});

// -------- Static files --------
app.MapGet("/static/{**path}", async context =>
{
    var path = context.Request.RouteValues["path"]?.ToString();
    var file = Path.Combine(staticDir, path ?? "");
    if (File.Exists(file))
    {
        await using var fs = File.OpenRead(file);
        context.Response.ContentType = "application/octet-stream";
        await fs.CopyToAsync(context.Response.Body);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        await context.Response.WriteAsync("Not found");
    }
});

// -------- Proxy /api/* --------
app.Map("/{**path}", async context =>
{
    var routePath = context.Request.Path.ToString();
    if (!routePath.StartsWith("/api/", StringComparison.Ordinal))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        await context.Response.WriteAsync("Not found");
        return;
    }

    var subpath = routePath.Substring("/api/".Length);
    var url = $"https://api.teller.io/{subpath}";

    var factory = context.RequestServices.GetRequiredService<IHttpClientFactory>();
    var client  = factory.CreateClient("Upstream");

    // Build upstream request
    var upstreamReq = new HttpRequestMessage(new HttpMethod(context.Request.Method), url);

    // Translate bearer-style token into Basic <base64(token:)>
    if (context.Request.Headers.TryGetValue("Authorization", out var rawAuth))
    {
        var token = rawAuth.ToString().Trim();
        if (!string.IsNullOrEmpty(token))
        {
            var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(token + ":"));
            upstreamReq.Headers.Authorization = new AuthenticationHeaderValue("Basic", encoded);
        }
    }

    // Forward JSON body for mutating methods
    if (HttpMethods.IsPost(context.Request.Method) ||
        HttpMethods.IsPut (context.Request.Method) ||
        HttpMethods.IsPatch(context.Request.Method))
    {
        context.Request.EnableBuffering();
        using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        context.Request.Body.Position = 0;
        upstreamReq.Content = new StringContent(body, Encoding.UTF8, "application/json");
    }

    // Ask for compressed responses; handler will decompress automatically
    if (!upstreamReq.Headers.AcceptEncoding.Any())
        upstreamReq.Headers.AcceptEncoding.ParseAdd("gzip, deflate, br");

    // Send upstream
    using var resp = await client.SendAsync(upstreamReq, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);

    // Mirror status + content-type
    context.Response.StatusCode = (int)resp.StatusCode;
    var contentType = resp.Content.Headers.ContentType?.ToString();
    if (!string.IsNullOrEmpty(contentType))
        context.Response.ContentType = contentType;

    // Stream body through
    await using var respStream = await resp.Content.ReadAsStreamAsync(context.RequestAborted);
    await respStream.CopyToAsync(context.Response.Body, context.RequestAborted);
});

app.Run($"http://0.0.0.0:{port}");