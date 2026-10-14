# Deploying the Quiz App to AWS (EC2)

The app is a static site (`public/`) served by nginx inside a Docker container.
These steps use a single small EC2 instance.

## 1. Launch an EC2 instance

1. Open the AWS Console → **EC2** → **Launch instance**.
2. **Name:** `quizapp`
3. **AMI:** *Amazon Linux 2023* (Ubuntu 22.04/24.04 also works).
4. **Instance type:** `t3.micro` (free-tier eligible) is plenty.
5. **Key pair:** create or choose one (you need it to SSH in).
6. **Network settings → Security group:** allow
   - **SSH (22)** from *My IP*
   - **HTTP (80)** from *Anywhere (0.0.0.0/0)*
7. Click **Launch instance** and note its **Public IPv4 address**.

## 2. Connect to the instance

```bash
# Amazon Linux user is ec2-user; on Ubuntu use ubuntu
ssh -i /path/to/key.pem ec2-user@<PUBLIC_IP>
```

(Or use **EC2 → Instance → Connect → EC2 Instance Connect** in the browser.)

## 3. Install & run the app

```bash
curl -fsSL https://raw.githubusercontent.com/almoskov/quizapp/main/deploy/setup-ec2.sh | bash
```

The script installs Docker + git, clones the repo to `~/quizapp`, builds the image and
starts the container on port 80 with auto-restart.

> If the repo is private, clone it yourself first (with a deploy key or token), then run
> `bash ~/quizapp/deploy/setup-ec2.sh`.

## 4. Open it

Go to `http://<PUBLIC_IP>/` in your browser.

## 5. Update questions / redeploy

1. Edit `public/questions.json` locally, commit and push.
2. On the server, re-run the script (it pulls the latest code and restarts the container):

   ```bash
   bash ~/quizapp/deploy/setup-ec2.sh
   ```

## Optional: launch without SSH (User data)

When launching the instance, expand **Advanced details → User data** and paste:

```bash
#!/bin/bash
export HOME=/root
curl -fsSL https://raw.githubusercontent.com/almoskov/quizapp/main/deploy/setup-ec2.sh | bash
```

The app will be up a couple of minutes after the instance boots.

## Troubleshooting

| Problem | Check |
|---|---|
| Browser can't connect | Security group allows inbound **HTTP 80**; use `http://` not `https://` |
| Container not running | `sudo docker ps -a` and `sudo docker logs quizapp` |
| Old questions shown | Re-run the setup script; hard-refresh the page |

## Optional: HTTPS / custom domain

Point a domain's A record at the instance's Elastic IP, then put a TLS terminator in front
(e.g. an Application Load Balancer with an ACM certificate, or Caddy/certbot on the instance).
