package com.example.teller;

import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.ssl.SSLContexts;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.*;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.*;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.*;

import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import javax.net.ssl.SSLContext;

@SpringBootApplication
@RestController
public class Application {

    private final String appId = getenv("APP_ID");
    private final String env = getenv("ENV", "sandbox");
    private final String certPath = System.getenv("CERT");     // path to PEM cert (or .crt)
    private final String keyPath = System.getenv("CERT_KEY");  // path to PEM private key

    private final File staticDir = new File("../static");
    private RestTemplate restTemplate;

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

    @PostConstruct
    public void init() throws Exception {
        if (env.equalsIgnoreCase("development") || env.equalsIgnoreCase("production")) {
            if (certPath == null || keyPath == null) {
                throw new IllegalStateException("CERT and CERT_KEY must be set in " + env);
            }

            Security.addProvider(new BouncyCastleProvider());

            // --- Load private key (PEM) ---
            PrivateKey privateKey;
            try (FileReader fr = new FileReader(keyPath);
                 PEMParser pp = new PEMParser(fr)) {

                Object obj = pp.readObject();
                JcaPEMKeyConverter conv = new JcaPEMKeyConverter().setProvider("BC");

                if (obj instanceof PEMKeyPair) {
                    privateKey = conv.getKeyPair((PEMKeyPair) obj).getPrivate();
                } else if (obj instanceof PrivateKeyInfo) {
                    privateKey = conv.getPrivateKey((PrivateKeyInfo) obj);
                } else {
                    throw new IllegalStateException("Unsupported private key PEM format: " + obj.getClass());
                }
            }

            // --- Load certificate (PEM) ---
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            Certificate cert;
            try (FileInputStream fis = new FileInputStream(certPath)) {
                cert = cf.generateCertificate(fis);
            }

            // --- Put into KeyStore (PKCS12 in-memory) ---
            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(null, null);
            ks.setKeyEntry("client", privateKey, new char[0], new Certificate[]{cert});

            // --- Build SSLContext with client cert + key ---
            SSLContext sslContext = SSLContexts.custom()
                .loadKeyMaterial(ks, new char[0])
                .build();

            // --- Wrap in a socket factory and connection manager ---
            var sslSocketFactory = org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder.create()
                .setSslContext(sslContext)
                .build();

            var connManager = org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder.create()
                .setSSLSocketFactory(sslSocketFactory)
                .build();

            HttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connManager)
                .build();

            this.restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
        } else {
            // sandbox: plain RestTemplate (no client cert)
            this.restTemplate = new RestTemplate();
        }
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

            // Ensure upstream can gzip; we accept compressed upstream responses
            headers.set("Accept-Encoding", "gzip");

            ResponseEntity<byte[]> resp = restTemplate.exchange(
                    url, method, new HttpEntity<>(entity.getBody(), headers), byte[].class
            );

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