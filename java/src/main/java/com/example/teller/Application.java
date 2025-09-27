package com.example.teller;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder;
import org.apache.hc.core5.ssl.SSLContexts;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import jakarta.servlet.http.HttpServletRequest;

import javax.net.ssl.SSLContext;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.*;

@SpringBootApplication
@EnableConfigurationProperties(Application.TellerProperties.class)
@RestController
public class Application {

    private final File staticDir = new File("../static");

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(Application.class);
        String port = System.getenv().getOrDefault("PORT", "8001");
        app.setDefaultProperties(java.util.Collections.singletonMap("server.port", port));
        app.run(args);
    }

    // ---------- RestTemplate with optional mTLS ----------
    @Bean
    public RestTemplate restTemplate(TellerProperties props) throws Exception {
        if (props.getEnv().equalsIgnoreCase("development") || props.getEnv().equalsIgnoreCase("production")) {
            Security.addProvider(new BouncyCastleProvider());

            // Load private key (PEM)
            PrivateKey privateKey;
            try (FileReader fr = new FileReader(props.getCertKey());
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

            // Load certificate (PEM)
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            X509Certificate cert;
            try (FileInputStream fis = new FileInputStream(props.getCert())) {
                cert = (X509Certificate) cf.generateCertificate(fis);
            }

            // Put into KeyStore (in-memory)
            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(null, null);
            ks.setKeyEntry("client", privateKey, new char[0], new Certificate[]{cert});

            // Build SSLContext
            SSLContext sslContext = SSLContexts.custom()
                    .loadKeyMaterial(ks, new char[0])
                    .build();

            var sslSocketFactory = SSLConnectionSocketFactoryBuilder.create()
                    .setSslContext(sslContext)
                    .build();

            var connManager = PoolingHttpClientConnectionManagerBuilder.create()
                    .setSSLSocketFactory(sslSocketFactory)
                    .build();

            HttpClient httpClient = HttpClients.custom()
                    .setConnectionManager(connManager)
                    .build();

            return new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
        } else {
            return new RestTemplate();
        }
    }

    // ---------- Root ----------
    @GetMapping("/")
    public ResponseEntity<String> root(TellerProperties props) throws IOException {
        File f = new File(staticDir, "index.html");
        String html = Files.readString(f.toPath(), StandardCharsets.UTF_8);
        html = html.replace("{{ app_id }}", props.getAppId())
                   .replace("{{ environment }}", props.getEnv());
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    // ---------- Static ----------
    @GetMapping("/static/{path:.+}")
    public ResponseEntity<byte[]> staticFile(@PathVariable String path) throws IOException {
        File f = new File(staticDir, path);
        if (!f.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().body(Files.readAllBytes(f.toPath()));
    }

    // ---------- Proxy /api/* ----------
    @RequestMapping("/api/**")
    public ResponseEntity<byte[]> proxy(HttpMethod method,
                                        HttpEntity<byte[]> entity,
                                        HttpServletRequest req,
                                        RestTemplate restTemplate) {
        try {
            String subpath = req.getRequestURI().substring("/api/".length());
            String url = "https://api.teller.io/" + subpath;

            HttpHeaders headers = new HttpHeaders();
            headers.putAll(entity.getHeaders());
            headers.remove("host");

            // Translate Authorization: <token> → Basic base64(token:)
            List<String> auth = headers.remove("authorization");
            if (auth != null && !auth.isEmpty()) {
                String token = auth.get(0).trim();
                String basic = Base64.getEncoder()
                        .encodeToString((token + ":").getBytes(StandardCharsets.UTF_8));
                headers.set("Authorization", "Basic " + basic);
            }

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

    // ---------- Configuration Properties with conditional validation ----------
    @ConfigurationProperties(prefix = "teller")
    @Validated
    public static class TellerProperties {

        // Defaults pull from your existing env vars so you don't need TELLER_* names
        @NotBlank(message = "APP_ID must be set")
        private String appId = System.getenv("APP_ID");

        private String env = System.getenv("ENV") != null ? System.getenv("ENV") : "sandbox";

        private String cert = System.getenv("CERT");

        private String certKey = System.getenv("CERT_KEY");

        // Conditional requirement for certs in dev/prod
        @AssertTrue(message = "CERT and CERT_KEY must be set when ENV=development or ENV=production")
        public boolean isCertsPresentIfRequired() {
            if ("development".equalsIgnoreCase(env) || "production".equalsIgnoreCase(env)) {
                return cert != null && !cert.isBlank() && certKey != null && !certKey.isBlank();
            }
            return true;
        }

        // ----- getters & setters (no omissions) -----
        public String getAppId() { return appId; }
        public void setAppId(String appId) { this.appId = appId; }

        public String getEnv() { return env; }
        public void setEnv(String env) { this.env = env; }

        public String getCert() { return cert; }
        public void setCert(String cert) { this.cert = cert; }

        public String getCertKey() { return certKey; }
        public void setCertKey(String certKey) { this.certKey = certKey; }
    }
}