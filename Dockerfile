FROM python:3.8

WORKDIR /frontend

COPY . .

ENTRYPOINT ["./entrypoint.sh"]