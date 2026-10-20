# Pre-Deployment Checklist — Topnet Solutions Academy

## GitHub Secrets Required

| Secret | Description | How to get |
|--------|-------------|-----------|
| `VM_ACADEMY_HOST` | IP de VM-ACADEMY | `10.202.101.144` |
| `VM_ACADEMY_USER` | SSH user | `deploy` ou `root` |
| `VM_SSH_KEY` | Clef SSH privee | `ssh-keygen` puis ajouter pub sur VM |
| `VM_ACADEMY_PASSWORD` | (optionnel si key) | Mot de passe SSH |
| `CI_REGISTRY` | (optionnel) | Default: `ghcr.io` |
| `CI_REGISTRY_IMAGE` | (optionnel) | Default: `ghcr.io/<owner>/topnet-academy` |

## .env.production — Secrets a recuperer

| Variable | Source | Action |
|----------|--------|--------|
| `BBB_SECRET` | VM-BBB | `ssh vm-bbb "cat /etc/bigbluebutton/bbb-web-config \| grep securitySalt"` |
| `TOPNET_SSO_CLIENT_SECRET` | Topnet Solutions Core Admin | Demander a l'equipe Topnet Solutions Core |
| `SMTP_PASSWORD` | IT Admin | Mot de passe pour `lms-alerts@topnet-solutions.com` |

## VM-ACADEMY — Setup initial (une seule fois)

```bash
# 1. Installer Docker + docker compose
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 2. Cloner le repo
git clone <repo-url> /opt/topnet-academy
cd /opt/topnet-academy

# 3. Copier .env.production -> .env
cp .env.production .env
# Remplir les 3 secrets manquants

# 4. Creer les reseaux Docker
docker network create academy-net || true

# 5. Premier deploiement
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Installer les crons de backup
cp infra/scripts/backup-cron.conf /etc/cron.d/topnet-backup
chmod 644 /etc/cron.d/topnet-backup

# 7. Verifier la sante
./infra/scripts/health-check.sh
```

## DNS

| Domaine | Type | Valeur |
|---------|------|--------|
| `learning.topnet-solutions.com` | A | `10.202.101.144` (IP publique VM-ACADEMY) |

## Verification post-deploiement

- [ ] `https://learning.topnet-solutions.com/login` charge la page de login
- [ ] `https://learning.topnet-solutions.com/api/courses/health` retourne `{"status":"ok"}`
- [ ] `https://learning.topnet-solutions.com/api/learning/health` retourne `{"status":"ok"}`
- [ ] `https://learning.topnet-solutions.com/api/assessment/health` retourne `{"status":"ok"}`
- [ ] `https://learning.topnet-solutions.com/api/live/health` retourne `{"status":"ok"}`
- [ ] Certificat TLS valide (Let's Encrypt)
- [ ] Login avec credentials de demo fonctionne
- [ ] Dashboard charge les donnees
- [ ] Grafana accessible a `https://learning.topnet-solutions.com/grafana`
- [ ] Backup cron actif : `crontab -l | grep topnet`

## Rollback

```bash
cd /opt/topnet-academy
# Revenir au commit precedent
git log --oneline -5
git checkout <previous-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
