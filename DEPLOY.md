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

## 2b. (Optional) Wipe an existing Kubernetes install

Skip this on a fresh instance. If the server already runs Kubernetes, remove it first:
it usually holds port 80/443 (e.g. the k3s Traefik ingress), so the quiz container can't start.

> ⚠️ This permanently deletes the cluster, its workloads **and their volumes/data**.
> Back up anything you need first (`kubectl get all -A`, persistent volume data, manifests).
>
> The cleanest "deep clean" is often to **terminate the instance and launch a fresh one** (step 1).
> If you need to keep this instance (Elastic IP, attached data, etc.), follow the steps below.

**1. Find out what is installed**

```bash
for b in k3s microk8s kubeadm minikube kind kubectl; do command -v $b; done
systemctl list-units --type=service --all | grep -Ei 'k3s|kube|microk8s|containerd|docker'
sudo ss -tlnp | grep -E ':(80|443|6443) '
```

**2. Run the uninstaller for your distribution**

| Distribution | Command |
|---|---|
| **k3s** (server) | `sudo /usr/local/bin/k3s-uninstall.sh` |
| **k3s** (agent) | `sudo /usr/local/bin/k3s-agent-uninstall.sh` |
| **MicroK8s** | `sudo snap remove microk8s --purge` |
| **minikube** | `minikube delete --all --purge && sudo rm -f /usr/local/bin/minikube` |
| **kind** | `kind delete clusters --all && sudo rm -f /usr/local/bin/kind` |
| **kubeadm** | see below |

For **kubeadm**:

```bash
sudo kubeadm reset -f
sudo systemctl disable --now kubelet
# Ubuntu/Debian:
sudo apt-get purge -y --allow-change-held-packages kubeadm kubelet kubectl kubernetes-cni cri-tools
sudo apt-get autoremove -y
# Amazon Linux:
sudo dnf remove -y kubeadm kubelet kubectl kubernetes-cni cri-tools
```

**3. Remove leftover files** (safe to run whichever distribution it was)

```bash
sudo rm -rf ~/.kube /root/.kube /etc/kubernetes /var/lib/kubelet /var/lib/etcd \
  /etc/cni /opt/cni /var/lib/cni /run/flannel /var/lib/calico /etc/rancher /var/lib/rancher
sudo rm -f /usr/local/bin/kubectl
```

**4. Reset the firewall rules** that Kubernetes created (EC2 security groups still protect the instance)

```bash
sudo iptables -P INPUT ACCEPT; sudo iptables -P FORWARD ACCEPT; sudo iptables -P OUTPUT ACCEPT
sudo iptables -F; sudo iptables -X
sudo iptables -t nat -F; sudo iptables -t nat -X
sudo iptables -t mangle -F; sudo iptables -t mangle -X
command -v ipvsadm >/dev/null && sudo ipvsadm --clear
```

**5. Clean old containers and images** (only if nothing else on the server uses Docker)

```bash
command -v docker >/dev/null && sudo docker system prune -a --volumes -f
```

**6. Reboot** to drop leftover virtual network interfaces (`cni0`, `flannel.1`, `cali*`, ...)

```bash
sudo reboot
```

**7. Verify**: after reconnecting, these should print nothing:

```bash
sudo ss -tlnp | grep -E ':(80|443|6443) '
ip -br link | grep -Ei 'cni|flannel|cali|cilium|kube'
```

Docker itself is reinstalled automatically by the setup script in step 3 if needed.

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
| `port is already allocated` / `address already in use` | Something else holds port 80: `sudo ss -tlnp \| grep ':80 '` (often a leftover Kubernetes ingress, see step 2b) |
| Old questions shown | Re-run the setup script; hard-refresh the page |

## Optional: HTTPS / custom domain

Point a domain's A record at the instance's Elastic IP, then put a TLS terminator in front
(e.g. an Application Load Balancer with an ACM certificate, or Caddy/certbot on the instance).
