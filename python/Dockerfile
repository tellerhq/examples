#
# creates a docker container for this web service
# drop both cert.pem and priv_key.pem in this directory if you plan on using certs
#

FROM python:3.8

WORKDIR /backend
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

ENV TELLER_ENVIRONMENT=sandbox
ENV CERT_PATH=certificate.pem
ENV CERT_KEY_PATH=priv_key.pem

ENTRYPOINT [ "./entrypoint.sh" ]



