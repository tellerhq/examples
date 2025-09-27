using System.Net.Http.Headers;
using System.Text;

// Env vars
var appId = Environment.GetEnvironmentVariable("APP_ID");
var env = Environment.GetEnvironmentVariable("ENV") ?? "sandbox";
var cert = Environment.GetEnvironmentVariable("CERT");
var certKey = Environment.GetEnvironmentVariable("CERT_KEY");
var port = Environment.GetEnvironmentVariable("PORT") ?? "8001";

if (string.IsNullOrEmpty(appId))
{
    Console.Error.WriteLine("APP_ID must be set");
    return;
}
if ((env == "development" || env == "production") &&
    (string.IsNullOrEmpty(cert) || string.IsNullOrEmpty(certKey)))
{
    Console.Error.WriteLine($"CERT and CERT_KEY must be set when ENV={env}");
    return;
}

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var staticDir = Path.Combine("..", "static");

// Root: inject config into index.html
app.MapGet("/", async context =>
{
    var html = await File.ReadAllTextAsync(Path.Combine(staticDir, "index.html"));
    html = html.Replace("{{ app_id }}", appId, StringComparison.Ordinal);
    html = html.Replace("{{ environment }}", env, StringComparison.Ordinal);
    context.Response.ContentType = "text/html";
    await context.Response.WriteAsync(html);
});

// Static
app.MapGet("/static/{**path}", async context =>
{
    var path = context.Request.RouteValues["path"]?.ToString();
    var file = Path.Combine(staticDir, path ?? "");
    if (File.Exists(file))
    {
        var bytes = await File.ReadAllBytesAsync(file);
        context.Response.ContentType = "application/octet-stream";
        await context.Response.Body.WriteAsync(bytes);
    }
    else
    {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsync("Not found");
    }
});

// Proxy /api/*
app.Map("/{**path}", async context =>
{
    var path = context.Request.Path.ToString();
    if (!path.StartsWith("/api/"))
    {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsync("Not found");
        return;
    }

    var subpath = path.Substring("/api/".Length);
    var url = $"https://api.teller.io/{subpath}";

    using var client = new HttpClient();
    if (context.Request.Headers.TryGetValue("Authorization", out var rawAuth))
    {
        var token = rawAuth.ToString().Trim();
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(token + ":"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", encoded);
    }

    var upstreamReq = new HttpRequestMessage(new HttpMethod(context.Request.Method), url);

    // Forward body if POST/PUT/PATCH
    if (context.Request.Method is "POST" or "PUT" or "PATCH")
    {
        using var reader = new StreamReader(context.Request.Body);
        var body = await reader.ReadToEndAsync();
        upstreamReq.Content = new StringContent(body, Encoding.UTF8, "application/json");
    }

    var resp = await client.SendAsync(upstreamReq);

    context.Response.StatusCode = (int)resp.StatusCode;
    context.Response.ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/json";

    var respBody = await resp.Content.ReadAsStringAsync();
    await context.Response.WriteAsync(respBody);
});

app.Run($"http://0.0.0.0:{port}");