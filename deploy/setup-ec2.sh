#!/usr/bin/env bash
# Installs Docker on an EC2 instance (Amazon Linux 2023 or Ubuntu), then builds and runs the quiz app.
# Usage (on the server):
#   curl -fsSL https://raw.githubusercontent.com/almoskov/quizapp/main/deploy/setup-ec2.sh | bash
# or, from a cloned repo:
#   bash deploy/setup-ec2.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/almoskov/quizapp.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$HOME/quizapp}"

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    echo "Docker already installed."
    return
  fi

  . /etc/os-release
  case "$ID" in
    amzn)
      sudo dnf install -y docker git
      ;;
    ubuntu|debian)
      sudo apt-get update -y
      sudo apt-get install -y docker.io git
      ;;
    *)
      echo "Unsupported OS: $ID. Install Docker and git manually." >&2
      exit 1
      ;;
  esac

  sudo systemctl enable --now docker
}

install_docker
command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }

if [ -d "$APP_DIR/.git" ]; then
  echo "Updating existing checkout in $APP_DIR"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  echo "Cloning $REPO_URL into $APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
sudo docker build -t quizapp:latest .
sudo docker rm -f quizapp >/dev/null 2>&1 || true
sudo docker run -d --name quizapp --restart unless-stopped -p 80:80 quizapp:latest

echo
echo "Quiz app is running. Open: http://$(curl -fsS --max-time 2 https://checkip.amazonaws.com 2>/dev/null || echo '<your-ec2-public-ip>')/"
