package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"os"
	"path/filepath"
	"strings"
)

var (
	appID       = os.Getenv("APP_ID")
	environment = getEnv("ENV", "sandbox")
	certPath    = os.Getenv("CERT")
	keyPath     = os.Getenv("CERT_KEY")
	port        = getEnv("PORT", "8001")
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	if appID == "" {
		log.Fatal("APP_ID must be set (e.g. APP_ID=app_xxx)")
	}
	if (environment == "development" || environment == "production") &&
		(certPath == "" || keyPath == "") {
		log.Fatalf("CERT and CERT_KEY must be set when ENV=%s", environment)
	}

	mux := http.NewServeMux()
	staticDir := filepath.Join("..", "static")

	// Root: serve index.html with replacements
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		data, err := os.ReadFile(filepath.Join(staticDir, "index.html"))
		if err != nil {
			http.Error(w, "index.html not found", 500)
			return
		}
		html := string(data)
		html = strings.Replace(html, "{{ app_id }}", appID, 1)
		html = strings.Replace(html, "{{ environment }}", environment, 1)
		w.Header().Set("Content-Type", "text/html")
		io.WriteString(w, html)
	})

	// Static assets
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	// Proxy for /api/*
	mux.Handle("/api/", newTellerProxy())

	log.Printf("Listening on http://localhost:%s (ENV=%s, APP_ID=%s)", port, environment, appID)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, mux))
}

func newTellerProxy() http.Handler {
	// Setup TLS if needed
	var tlsConfig *tls.Config
	if certPath != "" && keyPath != "" {
		cert, err := tls.LoadX509KeyPair(certPath, keyPath)
		if err != nil {
			log.Fatalf("failed to load cert/key: %v", err)
		}
		tlsConfig = &tls.Config{
			Certificates: []tls.Certificate{cert},
			RootCAs:      x509.NewCertPool(),
		}
	}

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			// Rewrite URL: strip /api
			req.URL.Scheme = "https"
			req.URL.Host = "api.teller.io"
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/api")

			// Fix Authorization header: Basic token:
			if token := req.Header.Get("Authorization"); token != "" {
				encoded := base64.StdEncoding.EncodeToString([]byte(token + ":"))
				req.Header.Set("Authorization", "Basic "+encoded)
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			// Strip hop-by-hop headers only
			for _, h := range []string{"Connection", "Transfer-Encoding"} {
				resp.Header.Del(h)
			}
			// Keep Content-Encoding so the browser can decompress gzip
			return nil
		},
	}
	if tlsConfig != nil {
		proxy.Transport = &http.Transport{TLSClientConfig: tlsConfig}
	}
	return proxy
}