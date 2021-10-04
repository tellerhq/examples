# Teller Examples

## Introduction

This repository contains a small web front-end that allows easy interaction with Teller Connect and Teller's API via a back-end written in one of many languages. It can also serve as a starting point for your Teller integration.

## Docker Set-Up

This can be quickly spun up by utilizing docker. Make sure you have [docker](https://www.docker.com/) installed and [docker-compose](https://docs.docker.com/compose/). Change the appropriate environment values in the `docker-compose.yml` file and run:

`docker-compose up --build -d`

Then navigate to `127.0.0.1:8000` to begin using app

## Set-Up

The only general dependency for the project is `python` version `3+`. Go ahead and clone the repository on your local machine. Based on the language you want to use for your back-end, visit the language's folder `README.md` for further instructions. Once the back-end is running locally, proceed to starting the static file server for the front-end application. Open the `static/index.js` file and fill the value associated to the `APPLICATION_ID` constant which appears at the top of the file with your Teller application's ID. If you are not sure what it is, visit [this page](https://teller.io/settings/application) to find it. You can also change the `ENVIRONMENT` based on whether you want to target real (`development`, `production`) or fake (`sandbox`) bank accounts. Save the file then run: 
```
$ ./static.sh
```

This will start a simple HTTP server listening on `:8000`. You can now visit [localhost:8000](http://localhost:8000) in your browser and start using the application.

## Usage

Use the *Connect* button on the top-right of the screen to enroll a new user. Upon completion, you will see the list of bank accounts on the page. You can interact with them by requesting their details, balances and transactions from Teller.

The *User* specified on the right-hand side is the Teller identifier associated to the user whose accounts were enrolled. The *Access Token* authorizes your Teller application to access the user's account data. For more information you can read our online [documentation](https://teller.io/docs).
