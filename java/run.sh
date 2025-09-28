#!/usr/bin/env bash
set -euo pipefail

# Ensure JDK
if ! command -v java >/dev/null 2>&1; then
  echo "Installing JDK 17..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y openjdk-17-jdk
  elif command -v brew >/dev/null 2>&1; then
    brew install openjdk@17
  else
    echo "ERROR: cannot auto-install Java on this system"
    exit 1
  fi
fi

# Use Maven wrapper if available
if [ -x ./mvnw ]; then
  ./mvnw dependency:go-offline
  exec ./mvnw spring-boot:run
elif command -v mvn >/dev/null 2>&1; then
  mvn dependency:go-offline
  exec mvn spring-boot:run
else
  echo "Installing Maven..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y maven
    mvn dependency:go-offline
    exec mvn spring-boot:run
  elif command -v brew >/dev/null 2>&1; then
    brew install maven
    mvn dependency:go-offline
    exec mvn spring-boot:run
  else
    echo "ERROR: cannot auto-install Maven on this system"
    exit 1
  fi
fi