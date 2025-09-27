package com.example.teller;

import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import jakarta.servlet.http.HttpServletRequest;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

@SpringBootApplication
@RestController
public class Application {

    private final String appId = getenv("APP_ID");
    private final String env = getenv("ENV", "sandbox");
    private final String cert = System.getenv("CERT");
    private final String certKey = System.getenv("CERT_KEY");

    private final File staticDir = new File("../static");

    private static String getenv(String key) {
        String v = System.getenv(key);
        if (v == null || v.isEmpty()) {
            throw new RuntimeException("Missing required env var: " + key);
        }
        return v;
    }

    private static String getenv(String key, String def) {
        String v = System.getenv(key);
        return (v == null || v.isEmpty()) ? def : v;
    }

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(Application.class);
        String port = System.getenv().getOrDefault("PORT", "8001");
        app.setDefaultProperties(Collections.singletonMap("server.port", port));
        app.run(args);
    }

    // ---------- Root ----------
    @GetMapping("/")
    public ResponseEntity<String> root() throws IOException {
        File f = new File(staticDir, "index.html");
        String html = Files.readString(f.toPath(), StandardCharsets.UTF_8);
        html = html.replace("{{ app_id }}", appId)
                   .replace("{{ environment }}", env);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    // ---------- Static ----------
    @GetMapping("/static/{path:.+}")
    public ResponseEntity<byte[]> staticFile(@PathVariable String path) throws IOException {
        File f = new File(staticDir, path);
        if (!f.exists()) {
            return ResponseEntity.notFound().build();
        }
        byte[] bytes = Files.readAllBytes(f.toPath());
        return ResponseEntity.ok().body(bytes);
    }

    // ---------- Proxy /api/* ----------
    @RequestMapping("/api/**")
    public ResponseEntity<byte[]> proxy(HttpMethod method,
                                        HttpEntity<byte[]> entity,
                                        HttpServletRequest req) {
        try {
            String subpath = req.getRequestURI().substring("/api/".length());
            String url = "https://api.teller.io/" + subpath;

            HttpHeaders headers = new HttpHeaders();
            headers.putAll(entity.getHeaders());
            headers.remove("host");

            List<String> auth = headers.remove("authorization");
            if (auth != null && !auth.isEmpty()) {
                String token = auth.get(0).trim();
                String basic = Base64.getEncoder()
                                     .encodeToString((token + ":").getBytes(StandardCharsets.UTF_8));
                headers.set("Authorization", "Basic " + basic);
            }

            // 🚨 Force accept gzip, and get raw gzipped body
            headers.set("Accept-Encoding", "gzip");

            RestTemplate client = new RestTemplate();
            ResponseEntity<byte[]> resp = client.exchange(
                url, method, new HttpEntity<>(entity.getBody(), headers), byte[].class
            );

            // ✅ Forward upstream headers *including* Content-Encoding
            HttpHeaders respHeaders = new HttpHeaders();
            resp.getHeaders().forEach((k, v) -> {
                String lower = k.toLowerCase();
                if (!Arrays.asList("transfer-encoding", "connection").contains(lower)) {
                    respHeaders.put(k, v);
                }
            });

            return new ResponseEntity<>(resp.getBody(), respHeaders, resp.getStatusCode());

        } catch (Exception e) {
            return ResponseEntity.status(502)
                .contentType(MediaType.TEXT_PLAIN)
                .body(("Upstream error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }
}