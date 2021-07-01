# Teller Python Example

## Install

```
$ python3 -m venv .venv
$ source .venv/bin/activate
$ pip3 install -r requirements.txt
```

## Run

You can specify the environment you want to target (one of `sandbox`, `development`, `production`). If the latter is set to `development` or `production` you also need to set the `--cert` and `--cert-key` arguments that point to the certificate and private key files associated to your Teller Application. You can manage your certificates on the [developer's dashboard](https://teller.io/settings/certificates).

```
$ python3 teller.py --environment development --cert /path/to/cert.pem --cert-key /path/to/key.pem
```

A HTTP server will now listen on `:8001` for the web application front-end to talk to.
